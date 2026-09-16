import assert from "node:assert/strict";
import { test } from "node:test";
import { defineCase, defineMatrix } from "../../src/contracts.ts";

function exampleCase() {
  return {
    schemaVersion: 2, id: "example", revision: 2, title: "Example", task: "Read the status.",
    datasetId: "sample", datasetRevision: 1, excludedFromSuccess: ["Footer"],
    states: [{
      id: "ready", revision: 2, description: "Ready", preparation: ["Reset"], readyWhen: ["Status appears"],
      requirements: [{
        id: "status", category: "content", goal: "Understand the current status.",
        evidence: [{ id: "plain", allOf: [{ kind: "text", scope: { kind: "page" }, text: "Ready" }] }],
      }],
    }],
  };
}

const stack = { id: "react", title: "React", framework: "React", libraries: ["Radix"] };
const variant = { id: "text-actions", title: "Text", description: "Direct text actions." };
const icons = { id: "icon-toolbar", title: "Icons", description: "Toolbar image buttons." };
const registration = {
  caseId: "example", stackId: "react", variantId: "text-actions", stateIds: ["ready"], adapterModule: "./src/example.ts",
};
function plan(caseIds = ["example"], stackIds = ["react"]) {
  return {
    variants: [variant],
    implementations: caseIds.flatMap(caseId => stackIds.map(stackId => ({ caseId, stackId, variantId: variant.id }))),
  };
}

test("goal contracts have stable IDs, nonempty denominators and explicit revisions", () => {
  assert.equal(defineCase(exampleCase()).states[0]?.requirements.length, 1);
  for (const patch of [{ revision: 0 }, { id: "Example X" }, { states: [] }, { schemaVersion: 1 }]) {
    assert.throws(() => defineCase({ ...exampleCase(), ...patch }));
  }
  const empty = exampleCase();
  empty.states[0]!.requirements = [];
  assert.throws(() => defineCase(empty));
});

test("selectors, variant exemptions and the old single-rule schema are rejected", () => {
  const uxCase = exampleCase();
  for (const extra of [{ selector: ".MuiButton-root" }, { variantId: "text-actions" }, { rule: {} }]) {
    assert.throws(() => defineCase({
      ...uxCase,
      states: [{ ...uxCase.states[0], requirements: [{ ...uxCase.states[0]!.requirements[0], ...extra }] }],
    }));
  }
});

test("every evidence alternative is nonempty and uniquely named", () => {
  for (const edit of ["no-alternatives", "no-rules", "duplicate"]) {
    const uxCase = exampleCase();
    const requirement = uxCase.states[0]!.requirements[0]!;
    if (edit === "no-alternatives") requirement.evidence = [];
    if (edit === "no-rules") requirement.evidence[0]!.allOf = [];
    if (edit === "duplicate") requirement.evidence.push(requirement.evidence[0]!);
    assert.throws(() => defineCase(uxCase));
  }
});

test("duplicate state, goal and field identities are rejected", () => {
  const uxCase = exampleCase();
  assert.throws(() => defineCase({ ...uxCase, states: [...uxCase.states, ...uxCase.states] }));
  const state = uxCase.states[0]!;
  assert.throws(() => defineCase({
    ...uxCase, states: [{ ...state, requirements: [...state.requirements, ...state.requirements] }],
  }));
  for (const kind of ["record", "properties"]) {
    assert.throws(() => defineCase({
      ...uxCase,
      states: [{
        ...state,
        requirements: [{
          id: "row", category: "content", goal: "Read the amount.",
          evidence: [{ id: "fields", allOf: [{
            kind, scope: { kind: "row", anchor: "1" },
            fields: [{ label: "Amount", value: "1" }, { label: "Amount", value: "2" }],
          }] }],
        }],
      }],
    }));
  }
});

test("every alternative for a control goal must preserve an affordance, not just text", () => {
  const uxCase = exampleCase();
  uxCase.states[0]!.requirements[0]!.category = "control";
  assert.throws(() => defineCase(uxCase), /control-goal alternative/);
});

test("the matrix requires explicit coverage as cases and stacks grow", () => {
  const a = exampleCase();
  const b = { ...a, id: "second" };
  const otherStack = { ...stack, id: "vue" };
  assert.equal(defineMatrix([a], [stack], plan()).length, 1);
  const matrix = defineMatrix([a, b], [stack, otherStack], plan(["example", "second"], ["react", "vue"]));
  assert.equal(matrix.length, 4);
  assert.ok(matrix.every(cell => cell.status === "planned" && cell.stateIds[0] === "ready"));
  assert.throws(() => defineMatrix([a, b], [stack], plan()), /Missing implementation plan/);
});

test("one stack can implement a case with multiple paradigms and identical state requirements", () => {
  const planning = plan();
  planning.variants.push(icons);
  planning.implementations.push({ caseId: "example", stackId: "react", variantId: icons.id });
  const matrix = defineMatrix([exampleCase()], [stack], planning, [registration]);
  assert.equal(matrix.length, 2);
  assert.deepEqual(matrix.map(cell => cell.variantId), ["text-actions", "icon-toolbar"]);
  assert.deepEqual(matrix.map(cell => cell.stateIds), [["ready"], ["ready"]]);
  assert.deepEqual(matrix.map(cell => cell.status), ["registered", "planned"]);
});

test("registration must cover every goal-state and a planned case/stack/variant identity", () => {
  assert.equal(defineMatrix([exampleCase()], [stack], plan(), [registration])[0]?.status, "registered");
  for (const invalid of [
    { ...registration, caseId: "unknown" }, { ...registration, stackId: "unknown" },
    { ...registration, variantId: "unknown" }, { ...registration, stateIds: ["different"] },
    { ...registration, stateIds: ["ready", "extra"] }, { ...registration, stateIds: ["ready", "ready"] },
    { ...registration, adapterModule: "./../outside.ts" }, { ...registration, requirements: [] },
  ]) {
    assert.throws(() => defineMatrix([exampleCase()], [stack], plan(), [invalid]));
  }
  assert.throws(() => defineMatrix([exampleCase()], [stack], plan(), [registration, registration]), /Duplicate registration/);
});

test("unknown or duplicate variant plans and duplicate axes fail explicitly", () => {
  assert.throws(() => defineMatrix([exampleCase(), exampleCase()], [stack], plan()), /Duplicate case/);
  assert.throws(() => defineMatrix([exampleCase()], [stack, stack], plan()), /Duplicate stack/);
  assert.throws(() => defineMatrix([], [stack], plan()));
  const unknown = plan();
  unknown.implementations[0]!.variantId = "unknown";
  assert.throws(() => defineMatrix([exampleCase()], [stack], unknown), /Unknown matrix axis/);
  const duplicate = plan();
  duplicate.implementations.push(duplicate.implementations[0]!);
  assert.throws(() => defineMatrix([exampleCase()], [stack], duplicate), /Duplicate implementation/);
});
