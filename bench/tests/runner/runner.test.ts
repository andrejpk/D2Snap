import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { planSchema, reportSchema } from "../../src/runner/models.ts";
import { renderReport } from "../../src/runner/report.ts";
import { safePath, startServer } from "../../src/runner/server.ts";
import { assessOutput } from "../../src/evidence/index.ts";
import { records } from "../../src/matrix.ts";
import type { DemoReport } from "../../src/runner/models.ts";
import { sizeBar } from "../../src/runner/size-bar.ts";
import { presentationOrder } from "../../src/runner/presentation-order.ts";

test("POC configurations are explicit, bounded, unique and exclude artificial target IDs", async () => {
  const input = JSON.parse(await readFile(new URL("../../configs/poc.json", import.meta.url), "utf8"));
  const plan = planSchema.parse(input);
  assert.deepEqual(plan.profiles.map(profile => profile.id),
    ["1.0", "0.9", "0.8", "0.7", "0.6", "0.5", "0.4", "0.3", "0.2", "0.1"]);
  for (const profile of plan.profiles) assert.deepEqual(
    [profile.rE, profile.rA, profile.rT], [Number(profile.id), Number(profile.id), Number(profile.id)]);
  assert.equal(plan.options.uniqueIDs, false);
  assert.throws(() => planSchema.parse({ ...input, profiles: [...input.profiles, input.profiles[0]] }));
  assert.throws(() => planSchema.parse({ ...input, profiles: [{ id: "raw", rE: 0, rA: 0, rT: 0 }] }));
  assert.throws(() => planSchema.parse({ ...input, profiles: [{ id: "invalid", rE: 2, rA: 0, rT: 0 }] }));
  assert.throws(() => planSchema.parse({ ...input, profiles: [{ id: "0.5", rE: 0.5, rA: 0.4, rT: 0.5 }] }));
  assert.throws(() => planSchema.parse({ ...input, options: { ...input.options, uniqueIDs: true } }));
  assert.throws(() => planSchema.parse({ ...input, options: { ...input.options, unknownOption: true } }));
});

test("size bars use exact bytes and the true per-state maximum, with stable zero handling", () => {
  assert.equal(sizeBar(1000, 2000).percentage, 50);
  assert.equal(sizeBar(2000, 2000).percentage, 100);
  assert.equal(sizeBar(1, 3).percentage, 1 / 3 * 100);
  assert.equal(sizeBar(0, 0).percentage, 0);
  assert.match(sizeBar(0, 0).description, /bars are empty/);
  assert.match(sizeBar(2000, 2000).description, /including Raw.*100% = 2000 bytes/);
  assert.throws(() => sizeBar(2, 1));
  assert.throws(() => sizeBar(-1, 1));
  assert.throws(() => sizeBar(1, Infinity));
});

test("presentation orders Raw before numeric ascending levels without mutating stored results", () => {
  const results = ["browsing", "actions"].flatMap(stateId =>
    ["1.0", "0.9", "raw", "0.1", "0.2"].map(profileId => ({ stateId, profileId })));
  const before = structuredClone(results);
  const ordered = presentationOrder(results);
  assert.deepEqual(ordered.map(result => result.profileId), ["raw", "0.1", "0.2", "0.9", "1.0", "raw", "0.1", "0.2", "0.9", "1.0"]);
  assert.deepEqual(results, before);
});

test("preview serves only declared assets on loopback and refuses path escapes", async () => {
  for (const path of ["../secret", "a/../../secret", "a\\secret", "/absolute", "./hidden"]) {
    assert.equal(safePath(path), false);
  }
  const server = await startServer({
    "index.html": Buffer.from("<h1>Fixture</h1>").toString("base64"),
    "assets/main.js": Buffer.from("console.log('fixture')").toString("base64"),
  });
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await fetch(`${server.url}/fixture/`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<h1>Fixture</h1>");
    assert.match((await fetch(`${server.url}/fixture/assets/main.js`)).headers.get("content-type")!, /javascript/);
    assert.equal((await fetch(`${server.url}/fixture/missing`)).status, 404);
    assert.equal((await fetch(`${server.url}/fixture/`, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${server.url}/fixture/%2e%2e%2fsecret`)).status, 404);
  } finally { await server.close(); }
});

test("report preserves negative scores and escapes captured content instead of executing it", async () => {
  const state = records.states[0]!;
  const dangerous = '<script>window.__unexpected = true</script>';
  const assessment = assessOutput(dangerous, state, dangerous, "html");
  const report: DemoReport = {
    schemaVersion: 1, caseDefinition: records, generatedAt: "2026-06-15T12:00:00Z",
    caseId: "records", stackId: "react-shadcn", variantId: "icon-toolbar",
    subject: { label: "Current worktree", hash: "a".repeat(64) }, fixtureHash: "b".repeat(64),
    browser: { playwright: "pinned" },
    counts: { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 },
    captures: { browsing: { html: dangerous, screenshot: "" } },
    results: [{
      stateId: "browsing", profileId: "raw", configuration: null, assessment,
      output: dangerous, captureKey: "c".repeat(64), transformKey: null, assessmentKey: "d".repeat(64),
      cache: { capture: "hit", transform: "baseline", assessment: "hit" },
    }],
  };
  const plan = planSchema.parse(JSON.parse(await readFile(new URL("../../configs/poc.json", import.meta.url), "utf8")));
  const larger = dangerous.repeat(2);
  report.results.push({
    ...report.results[0]!, profileId: "1.0", configuration: { ...plan.profiles[0]!, options: plan.options },
    output: larger, assessment: assessOutput(larger, state, dangerous, "html"),
  });
  assert.deepEqual(reportSchema.parse(report), report);
  const html = renderReport(report);
  assert.ok(!html.includes(dangerous));
  const dom = new JSDOM(html);
  try {
    const data = JSON.parse(dom.window.document.querySelector("#bench-data")!.textContent!);
    assert.equal(data.results[0].output, dangerous);
    assert.ok([...dom.window.document.querySelectorAll("#bench-viewer th")]
      .every(header => !/cache/i.test(header.textContent ?? "")));
    assert.equal(dom.window.document.querySelectorAll('script[src],link[rel="stylesheet"],img[src^="http"]').length, 0);
    const bars = dom.window.document.querySelectorAll<HTMLElement>("#bench-viewer .bench-size-bar");
    assert.equal(bars[0]!.style.width, "50%");
    assert.equal(bars[1]!.style.width, "100%");
  } finally { dom.window.close(); }
  assert.ok(html.includes("Raw evidence is incomplete"));
  assert.ok(html.includes("Missing"));
  assert.ok(html.includes(`0/${state.requirements.length}`));
  assert.ok(html.includes("hit"));
});
