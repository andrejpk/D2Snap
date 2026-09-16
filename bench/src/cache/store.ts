import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, link, unlink, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { assertFields, assertSha256, canonicalJson, sha256 } from "./canonical.ts";
import type { JsonValue, Sha256 } from "./canonical.ts";

export interface CompletedResult {
  status: "completed";
  deterministic: true;
  value: JsonValue;
}
export interface CacheHit {
  status: "hit";
  key: Sha256;
  resultHash: Sha256;
  result: CompletedResult;
}
export interface CacheMiss { status: "miss"; key: Sha256; reason: "entry-missing" }
export interface CacheCorrupt {
  status: "corrupt";
  key: Sha256;
  reason: "invalid-entry" | "missing-result" | "invalid-result";
  diagnostic: string;
}
export type CacheRead = CacheHit | CacheMiss | CacheCorrupt;
export type CacheOutcome = CacheHit | {
  status: "created" | "refreshed";
  key: Sha256;
  resultHash: Sha256;
  result: CompletedResult;
  prior: CacheRead;
  observationId?: string;
};
export interface CacheStoreOptions { lockTimeoutMs?: number; lockPollMs?: number }
interface Entry { schema: 1; key: Sha256; resultHash: Sha256; observationId: string | null }

export class CacheConflictError extends Error {
  constructor(message: string) { super(message); this.name = "CacheConflictError"; }
}
export class CacheLockTimeoutError extends Error {
  constructor(path: string) { super(`Timed out waiting for cache lock: ${path}`); this.name = "CacheLockTimeoutError"; }
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
function validateCompleted(value: unknown): asserts value is CompletedResult {
  assertFields(value, ["status", "deterministic", "value"]);
  if (value.status !== "completed" || value.deterministic !== true) {
    throw new TypeError("Only completed deterministic results may be cached");
  }
}
function assertObservationId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) {
    throw new TypeError("Invalid observation ID");
  }
}
async function readOptional(path: string): Promise<Buffer | undefined> {
  try { return await readFile(path); }
  catch (error) { if (hasCode(error, "ENOENT")) return undefined; throw error; }
}
const inFlight = new Map<string, Promise<CacheOutcome>>();

/**
 * Trusted, exclusively cache-owned root on a local filesystem supporting hard links.
 * Keys coordinate across processes; abandoned locks require explicit operator intervention.
 */
export class CacheStore {
  readonly root: string;
  readonly lockTimeoutMs: number;
  readonly lockPollMs: number;

  constructor(root: string, options: CacheStoreOptions = {}) {
    if (typeof root !== "string" || !root.length) throw new TypeError("Cache root is required");
    this.root = resolve(root);
    this.lockTimeoutMs = options.lockTimeoutMs ?? 5_000;
    this.lockPollMs = options.lockPollMs ?? 20;
    if (!Number.isSafeInteger(this.lockTimeoutMs) || this.lockTimeoutMs < 0 ||
        !Number.isSafeInteger(this.lockPollMs) || this.lockPollMs < 1) {
      throw new TypeError("Lock timeout must be a nonnegative integer; polling interval must be positive");
    }
  }

  private entryPath(key: Sha256, observationId: string | null = null): string {
    assertSha256(key);
    if (observationId === null) return join(this.root, "entries", `${key}.json`);
    assertObservationId(observationId);
    return join(this.root, "observations", key, `${observationId}.json`);
  }
  private blobPath(hash: Sha256): string {
    assertSha256(hash);
    return join(this.root, "blobs", `${hash}.json`);
  }
  private async initialize(): Promise<void> {
    await Promise.all(["entries", "blobs", "locks", "pending", "corrupt", "observations"]
      .map(folder => mkdir(join(this.root, folder), { recursive: true })));
  }
  private async locked<T>(name: string, action: () => Promise<T>): Promise<T> {
    await this.initialize();
    const path = join(this.root, "locks", `${name}.lock`);
    const start = performance.now();
    let handle;
    for (;;) {
      try { handle = await open(path, "wx"); break; }
      catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
        const remaining = this.lockTimeoutMs - (performance.now() - start);
        if (remaining <= 0) throw new CacheLockTimeoutError(path);
        await delay(Math.min(this.lockPollMs, remaining));
      }
    }
    try { return await action(); }
    finally { await handle.close(); await unlink(path); }
  }
  private async record(key: Sha256, observationId: string | null): Promise<Entry | undefined> {
    const bytes = await readOptional(this.entryPath(key, observationId));
    if (!bytes) return undefined;
    const entry: unknown = JSON.parse(bytes.toString("utf8"));
    assertFields(entry, ["schema", "key", "resultHash", "observationId"]);
    assertSha256(entry.resultHash);
    if (entry.schema !== 1 || entry.key !== key || entry.observationId !== observationId ||
        !bytes.equals(Buffer.from(canonicalJson(entry)))) {
      throw new TypeError("Invalid, noncanonical, or misaddressed cache entry");
    }
    return { schema: 1, key, resultHash: entry.resultHash, observationId };
  }
  private async readAt(key: Sha256, observationId: string | null): Promise<CacheRead> {
    let entry;
    try { entry = await this.record(key, observationId); }
    catch (error) {
      if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error;
      return { status: "corrupt", key, reason: "invalid-entry", diagnostic: error.message };
    }
    if (!entry) return { status: "miss", key, reason: "entry-missing" };
    const bytes = await readOptional(this.blobPath(entry.resultHash));
    if (!bytes) {
      return { status: "corrupt", key, reason: "missing-result", diagnostic: `Missing result blob ${entry.resultHash}` };
    }
    try {
      if (sha256(bytes) !== entry.resultHash) throw new TypeError(`Result digest mismatch for ${entry.resultHash}`);
      const result: unknown = JSON.parse(bytes.toString("utf8"));
      validateCompleted(result);
      if (!bytes.equals(Buffer.from(canonicalJson(result)))) throw new TypeError("Noncanonical result blob");
      return { status: "hit", key, resultHash: entry.resultHash, result };
    } catch (error) {
      if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error;
      return { status: "corrupt", key, reason: "invalid-result", diagnostic: error.message };
    }
  }
  async read(key: Sha256): Promise<CacheRead> {
    assertSha256(key);
    return this.readAt(key, null);
  }
  async readObservation(key: Sha256, observationId: string): Promise<CacheRead> {
    assertSha256(key);
    assertObservationId(observationId);
    return this.readAt(key, observationId);
  }
  private async quarantine(path: string): Promise<void> {
    await rename(path, join(this.root, "corrupt", `${randomUUID()}.json`));
  }
  private async publish(path: string, bytes: string): Promise<void> {
    const pending = join(this.root, "pending", `${randomUUID()}.json`);
    const handle = await open(pending, "wx");
    try {
      try {
        await handle.writeFile(bytes, "utf8");
        await handle.sync();
      } finally { await handle.close(); }
      try { await link(pending, path); }
      catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
        const existing = await readOptional(path);
        if (!existing?.equals(Buffer.from(bytes))) throw new CacheConflictError(`Immutable cache conflict at ${path}`);
      }
    } finally { await unlink(pending); }
  }
  private async store(
    key: Sha256, result: CompletedResult, prior: CacheRead, observationId: string | null,
  ): Promise<CacheOutcome> {
    validateCompleted(result);
    const bytes = canonicalJson(result);
    const resultHash = sha256(bytes);
    // Detach returned data from producer-owned mutable objects.
    const snapshot = JSON.parse(bytes) as CompletedResult;
    const path = this.entryPath(key, observationId);
    let existing: Entry | undefined;
    let invalidEntry = false;
    try { existing = await this.record(key, observationId); }
    catch (error) {
      if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error;
      invalidEntry = true;
    }
    if (existing && existing.resultHash !== resultHash) {
      throw new CacheConflictError(`Key ${key} already identifies different completed content`);
    }
    await this.locked(`blob-${resultHash}`, async () => {
      const blob = this.blobPath(resultHash);
      const existingBytes = await readOptional(blob);
      if (existingBytes && !existingBytes.equals(Buffer.from(bytes))) {
        if (sha256(existingBytes) === resultHash) throw new CacheConflictError("Result hash collision");
        await this.quarantine(blob);
      }
      await this.publish(blob, bytes);
    });
    if (invalidEntry) await this.quarantine(path);
    await this.publish(path, canonicalJson({ schema: 1, key, resultHash, observationId }));
    if (observationId !== null) {
      return { status: "refreshed", key, resultHash, result: snapshot, prior, observationId };
    }
    if (prior.status === "hit") return { status: "hit", key, resultHash, result: snapshot };
    return { status: "created", key, resultHash, result: snapshot, prior };
  }
  async put(key: Sha256, result: CompletedResult): Promise<CacheOutcome> {
    assertSha256(key);
    validateCompleted(result);
    const snapshot = JSON.parse(canonicalJson(result)) as CompletedResult;
    return this.locked(`key-${key}`, async () => this.store(key, snapshot, await this.read(key), null));
  }
  getOrCreate(
    key: Sha256,
    producer: () => CompletedResult | Promise<CompletedResult>,
    options: { refresh?: boolean } = {},
  ): Promise<CacheOutcome> {
    assertSha256(key);
    if (typeof producer !== "function") throw new TypeError("Producer must be a function");
    if (options.refresh !== undefined && typeof options.refresh !== "boolean") throw new TypeError("Invalid refresh option");
    const flightKey = `${this.root}\0${key}\0${options.refresh === true}`;
    const pending = inFlight.get(flightKey);
    if (pending) return pending;
    const promise = this.locked(`key-${key}`, async () => {
      const prior = await this.read(key);
      if (prior.status === "hit" && !options.refresh) return prior;
      const result = await producer();
      const observationId = options.refresh ? randomUUID() : null;
      if (observationId) await mkdir(join(this.root, "observations", key), { recursive: true });
      return this.store(key, result, prior, observationId);
    });
    inFlight.set(flightKey, promise);
    const cleanup = () => { if (inFlight.get(flightKey) === promise) inFlight.delete(flightKey); };
    void promise.then(cleanup, cleanup);
    return promise;
  }
}
