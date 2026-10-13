import assert from "node:assert/strict";
import { test } from "node:test";
import { runDemo } from "../src/runner/run.ts";
import type { DemoReport } from "../src/runner/models.ts";

function measurements(report: DemoReport) {
  return report.results.map(result => ({
    stateId: result.stateId, profileId: result.profileId,
    output: result.output, assessment: result.assessment,
    captureKey: result.captureKey, transformKey: result.transformKey, assessmentKey: result.assessmentKey,
  }));
}

test("the real POC reproduces fresh observations and performs zero work on a warm run", { timeout: 180_000 }, async () => {
  // Refresh observations deliberately do not seed or replace canonical cache entries.
  await runDemo();
  const first = await runDemo({ refresh: true });
  const second = await runDemo({ refresh: true });
  assert.equal(first.results.length, 22);
  assert.equal(first.counts.captures, 2);
  assert.equal(first.counts.transforms, 20);
  assert.ok(first.results.filter(result => result.profileId === "raw").every(result => result.assessment.fullFidelity));
  assert.deepEqual(second.captures, first.captures);
  assert.deepEqual(second.subject, first.subject);
  assert.equal(second.fixtureHash, first.fixtureHash);
  assert.deepEqual(measurements(second), measurements(first));
  const warm = await runDemo({ assertCached: true });
  assert.deepEqual(measurements(warm), measurements(first));
  assert.ok(Object.values(warm.counts).every(count => count === 0));
});
