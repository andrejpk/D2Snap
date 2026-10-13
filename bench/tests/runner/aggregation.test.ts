import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateResults } from "../../src/runner/aggregation.ts";
import { assessOutput } from "../../src/evidence/index.ts";
import { records } from "../../cases/records.ts";
import type { ViewerData, ViewerResult } from "../../src/runner/viewer-model.ts";
import type { Configuration } from "../../src/runner/models.ts";
import { planSchema } from "../../src/runner/models.ts";
import { readFileSync } from "node:fs";

const plan = planSchema.parse(JSON.parse(readFileSync(new URL("../../configs/poc.json", import.meta.url), "utf8")));
const configuration: Configuration = { ...plan.profiles.at(-1)!, options: plan.options };
const baseline = assessOutput("", records.states[0]!, "", "html");
function result(stateId: string, profileId: string, numerator: number, denominator: number, bytes: number): ViewerResult {
  const retention = { numerator, denominator, fraction: numerator / denominator };
  return {
    id: `${stateId}-${profileId}`, stateId, profileId, output: "", goals: [],
    configuration: profileId === "raw" ? null : { ...configuration, id: profileId },
    preview: { document: "", highlights: {}, sourceHighlights: {} },
    assessment: {
      ...baseline, retention: { overall: retention, content: retention, control: retention },
      semanticRetention: { overall: retention, content: retention, control: retention },
      fullFidelity: numerator === denominator, outputBytes: bytes, outputKB: bytes / 1000, sizeRatio: bytes / 1000,
    },
  };
}
function cell(stackId: string, results: ViewerResult[]): ViewerData {
  return {
    schemaVersion: 1, states: [], results,
    report: {
      schemaVersion: 1, caseId: "records", stackId, variantId: "test-variant", caseDefinition: records,
      generatedAt: "2026-06-15T12:00:00Z", subject: { label: "Test", hash: "same-subject" },
      fixtureHash: stackId, browser: {}, captures: {}, results: [],
      counts: { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 },
    },
  };
}

test("dashboard averages state retention equally and excludes Raw from stack means", () => {
  const data = cell("first", [
    result("browsing", "raw", 3, 3, 1000), result("actions", "raw", 5, 5, 1000),
    result("browsing", "0.1", 3, 3, 100), result("actions", "0.1", 0, 5, 300),
  ]);
  const before = structuredClone(data);
  const rows = aggregateResults([data], "stack");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]!.stats, {
    samples: 2, cells: 1, retainedGoals: 3, requiredGoals: 8, meanRetention: 0.5, meanSemantic: 0.5,
    fullFidelity: 1, meanBytes: 200, meanRawRatio: 0.2,
  });
  assert.deepEqual(data, before);
});

test("configuration aggregates span stacks and order Raw then numeric levels", () => {
  const cells = ["first", "second"].map(stack => cell(stack, [
    result("browsing", "1.0", 0, 3, 50), result("browsing", "raw", 3, 3, 1000),
    result("browsing", "0.1", 3, 3, 100),
  ]));
  const rows = aggregateResults(cells, "config");
  assert.deepEqual(rows.map(row => row.profileId), ["raw", "0.1", "1.0"]);
  assert.ok(rows.every(row => row.stats.cells === 2 && row.stats.samples === 2));
  assert.equal(rows[1]!.stats.meanBytes, 100);
});

test("same profile name with different options is not pooled; missing ratios stay N/A", () => {
  const first = result("browsing", "0.1", 3, 3, 100);
  const second = structuredClone(first);
  second.configuration!.options = { ...second.configuration!.options, skipMarkdown: true };
  first.assessment.sizeRatio = null;
  second.assessment.sizeRatio = null;
  const rows = aggregateResults([cell("first", [first]), cell("second", [second])], "config");
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.stats.meanRawRatio === null));
});
