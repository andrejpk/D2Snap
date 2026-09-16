import assert from "node:assert/strict";
import { test } from "node:test";
import { dataset } from "@perception-bench/scenarios";
import { cases, matrix, stacks, variants } from "../../src/matrix.ts";
import { equivalentControls, negativeControls, positiveControls } from "./controls.ts";

test("the approved POC is exactly three cases by three stacks and six shared states", () => {
  assert.deepEqual(cases.map(uxCase => uxCase.id), ["records", "request-form", "request-detail"]);
  assert.equal(stacks.length, 3);
  assert.equal(matrix.length, 9);
  assert.equal(matrix.reduce((sum, cell) => sum + cell.stateIds.length, 0), 18);
  assert.ok(matrix.every(cell => cell.status === "planned"));
  assert.ok(matrix.every(cell => variants.some(variant => variant.id === cell.variantId)));
});

test("every state has independent positive and negative scorer controls", () => {
  const stateIds = cases.flatMap(uxCase => uxCase.states.map(state => `${uxCase.id}/${state.id}`));
  assert.deepEqual(Object.keys(positiveControls).sort(), [...stateIds].sort());
  assert.deepEqual(Object.keys(negativeControls).sort(), [...stateIds].sort());
  assert.deepEqual(Object.keys(equivalentControls).sort(), [...stateIds].sort());
  for (const uxCase of cases) {
    assert.equal(uxCase.datasetId, dataset.id);
    assert.equal(uxCase.datasetRevision, dataset.revision);
    for (const state of uxCase.states) {
      const negative = negativeControls[`${uxCase.id}/${state.id}`]!;
      assert.ok(state.requirements.some(item => item.id === negative.missingItem));
    }
  }
});

test("public scenario data has no oracle, correct-target flags or scoring expectations", () => {
  const forbidden = new Set(["requirements", "oracle", "correct", "target", "expected", "score", "rule"]);
  function visit(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbidden.has(key.toLowerCase()), `Oracle-like field leaked: ${key}`);
      visit(child);
    }
  }
  visit(dataset);
  assert.equal(new Set(dataset.requests.map(request => request.id)).size, dataset.requests.length);
});
