import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import type { TestContext } from "node:test";
import {
  CacheConflictError, CacheLockTimeoutError, CacheStore, canonicalJson, sha256,
} from "../../src/cache/index.ts";
import type { CompletedResult } from "../../src/cache/index.ts";

const key = sha256("transform-manifest");
const failed: CompletedResult = { status: "completed", deterministic: true, value: { verdict: "fail", coverage: 0.5 } };

async function setup(t: TestContext, options: { lockTimeoutMs?: number; lockPollMs?: number } = {}) {
  const root = await mkdtemp(join(import.meta.dirname, ".scratch-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return new CacheStore(root, options);
}

test("miss, immutable roundtrip, and cached deterministic negative verdict hit", async t => {
  const store = await setup(t);
  assert.deepEqual(await store.read(key), { status: "miss", key, reason: "entry-missing" });
  let calls = 0;
  const first = await store.getOrCreate(key, () => { calls++; return failed; });
  assert.equal(first.status, "created");
  assert.deepEqual(first.result, failed);
  const hit = await new CacheStore(store.root).getOrCreate(key, () => { throw new Error("must not run"); });
  assert.equal(hit.status, "hit");
  assert.deepEqual(hit.result, failed);
  assert.equal(calls, 1);
  assert.equal((await store.put(key, failed)).status, "hit");
  await assert.rejects(store.put(key, { ...failed, value: { verdict: "pass" } }), CacheConflictError);
  assert.deepEqual((await store.read(key)).status, "hit");
  assert.deepEqual(await readdir(join(store.root, "pending")), []);
  assert.deepEqual(await readdir(join(store.root, "locks")), []);
});

test("rejected and incomplete producers are never memoized", async t => {
  const store = await setup(t);
  let calls = 0;
  const crash = () => { calls++; throw new Error("crash"); };
  await assert.rejects(store.getOrCreate(key, crash), /crash/);
  await assert.rejects(store.getOrCreate(key, crash), /crash/);
  assert.equal(calls, 2);
  await assert.rejects(store.getOrCreate(key, async () => { throw new Error("timeout"); }), /timeout/);
  await assert.rejects(store.getOrCreate(key, () => ({ status: "incomplete", value: null }) as never));
  await assert.rejects(store.getOrCreate(key, () => ({ ...failed, deterministic: false }) as never));
  await assert.rejects(store.getOrCreate(key, () => ({ ...failed, value: undefined }) as never));
  assert.equal((await store.read(key)).status, "miss");
  assert.equal((await store.getOrCreate(key, () => failed)).status, "created");
});

test("concurrent get-or-create coalesces across store instances and retries a shared rejection", async t => {
  const store = await setup(t);
  let calls = 0;
  const producer = async () => { calls++; await delay(20); return failed; };
  const results = await Promise.all(Array.from({ length: 20 }, () => new CacheStore(store.root).getOrCreate(key, producer)));
  assert.equal(calls, 1);
  assert.ok(results.every(result => result.resultHash === results[0]!.resultHash));
  const next = sha256("next");
  const rejected = await Promise.allSettled(Array.from({ length: 10 }, () => store.getOrCreate(next, async () => {
    calls++; await delay(20); throw new Error("failed");
  })));
  assert.ok(rejected.every(result => result.status === "rejected"));
  assert.equal(calls, 2);
  assert.equal((await store.getOrCreate(next, producer)).status, "created");
  assert.equal(calls, 3);
});

test("corrupt blobs and missing blobs have diagnostics, recover, and preserve known immutable identity", async t => {
  const store = await setup(t);
  const created = await store.put(key, failed);
  const path = join(store.root, "blobs", `${created.resultHash}.json`);
  await writeFile(path, "truncated");
  const corrupt = await store.read(key);
  assert.equal(corrupt.status, "corrupt");
  if (corrupt.status !== "corrupt") assert.fail("Expected corruption");
  assert.equal(corrupt.reason, "invalid-result");
  assert.match(corrupt.diagnostic, /digest mismatch/);
  await assert.rejects(store.getOrCreate(key, () => ({ ...failed, value: "different" })), CacheConflictError);
  const repaired = await store.getOrCreate(key, () => failed);
  assert.equal(repaired.status, "created");
  assert.equal(repaired.prior.status, "corrupt");
  assert.equal((await store.read(key)).status, "hit");
  assert.equal((await readdir(join(store.root, "corrupt"))).length, 1);
  await rm(path);
  const missing = await store.read(key);
  assert.equal(missing.status, "corrupt");
  if (missing.status === "corrupt") assert.equal(missing.reason, "missing-result");
  assert.equal((await store.getOrCreate(key, () => failed)).status, "created");
});

test("invalid entry records invalidate hits, recover visibly, and never use poisoned paths", async t => {
  const store = await setup(t);
  await store.put(key, failed);
  const path = join(store.root, "entries", `${key}.json`);
  for (const content of [
    "{partial", canonicalJson({ schema: 1, key, resultHash: "../outside", observationId: null }),
    canonicalJson({ schema: 1, key: sha256("wrong"), resultHash: sha256(canonicalJson(failed)), observationId: null }),
  ]) {
    await writeFile(path, content);
    const read = await store.read(key);
    assert.equal(read.status, "corrupt");
    if (read.status === "corrupt") assert.equal(read.reason, "invalid-entry");
    const recovery = await store.getOrCreate(key, () => failed);
    assert.equal(recovery.status, "created");
    assert.equal(recovery.prior.status, "corrupt");
  }
  assert.equal((await readdir(join(store.root, "corrupt"))).length, 3);
});

test("refresh records a new accessible observation without overwriting the canonical result", async t => {
  const store = await setup(t);
  const original = await store.put(key, failed);
  const fresh: CompletedResult = { ...failed, value: { verdict: "pass" } };
  const observation = await store.getOrCreate(key, () => fresh, { refresh: true });
  assert.equal(observation.status, "refreshed");
  assert.ok(observation.observationId, "Expected fresh observation");
  const read = await store.readObservation(key, observation.observationId);
  assert.equal(read.status, "hit");
  if (read.status === "hit") assert.deepEqual(read.result, fresh);
  const originalRead = await store.read(key);
  assert.equal(originalRead.status, "hit");
  if (originalRead.status === "hit") assert.equal(originalRead.resultHash, original.resultHash);
  const again = await store.getOrCreate(key, () => fresh, { refresh: true });
  assert.notEqual(again.status === "hit" ? undefined : again.observationId, observation.observationId);
  await assert.rejects(store.getOrCreate(key, () => { throw new Error("interrupted"); }, { refresh: true }));
  assert.equal((await readdir(join(store.root, "observations", key))).length, 2);
});

test("invalid keys and observation IDs are rejected before filesystem use", async t => {
  const store = await setup(t);
  for (const invalid of ["../escape", key.toUpperCase(), `${key}\n`, "f".repeat(63), null, {}, ""]) {
    await assert.rejects(store.read(invalid as never), TypeError);
    await assert.rejects(store.put(invalid as never, failed), TypeError);
    assert.throws(() => store.getOrCreate(invalid as never, () => failed), TypeError);
  }
  await assert.rejects(store.readObservation(key, "../escape"), TypeError);
  assert.deepEqual(await readdir(store.root), []);
});

test("lock waiting is bounded, visible, and never deletes an abandoned lock", async t => {
  const store = await setup(t, { lockTimeoutMs: 30, lockPollMs: 5 });
  await mkdir(join(store.root, "locks"));
  const path = join(store.root, "locks", `key-${key}.lock`);
  await writeFile(path, "another owner");
  let called = false;
  await assert.rejects(store.getOrCreate(key, () => { called = true; return failed; }), CacheLockTimeoutError);
  assert.equal(called, false);
  assert.equal(await readFile(path, "utf8"), "another owner");
});

test("cross-process producers coordinate by key", async t => {
  const store = await setup(t);
  const marker = join(store.root, "producers.txt");
  const moduleUrl = new URL("../../src/cache/index.ts", import.meta.url).href;
  const script = `
    import { CacheStore } from ${JSON.stringify(moduleUrl)};
    import { appendFile } from "node:fs/promises";
    import { setTimeout as delay } from "node:timers/promises";
    const store = new CacheStore(${JSON.stringify(store.root)});
    await store.getOrCreate(${JSON.stringify(key)}, async () => {
      await appendFile(${JSON.stringify(marker)}, "produced\\n");
      await delay(80);
      return ${JSON.stringify(failed)};
    });
  `;
  const run = () => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script],
      { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", data => { stderr += String(data); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(stderr)));
  });
  await Promise.all([run(), run()]);
  assert.equal(await readFile(marker, "utf8"), "produced\n");
  assert.equal((await store.read(key)).status, "hit");
});

test("integrity alone is insufficient: digest-valid incomplete blobs are still corrupt", async t => {
  const store = await setup(t);
  await store.put(key, failed);
  const bytes = canonicalJson({ status: "crashed", deterministic: true, value: null });
  const resultHash = sha256(bytes);
  await writeFile(join(store.root, "blobs", `${resultHash}.json`), bytes);
  await writeFile(join(store.root, "entries", `${key}.json`), canonicalJson({ schema: 1, key, resultHash, observationId: null }));
  const read = await store.read(key);
  assert.equal(read.status, "corrupt");
  if (read.status === "corrupt") assert.match(read.diagnostic, /completed deterministic/);
});
