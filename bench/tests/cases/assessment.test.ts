import assert from "node:assert/strict";
import { test } from "node:test";
import { assessOutput } from "../../src/evidence/index.ts";
import { cases, records } from "../../src/matrix.ts";
import { equivalentControls, negativeControls, positiveControls, wrongActionAssociations } from "./controls.ts";

for (const uxCase of cases) {
  for (const state of uxCase.states) {
    const id = `${uxCase.id}/${state.id}`;
    const original = positiveControls[id]!;
    test(`${id}: different UI paradigms satisfy the same goals and denominator`, () => {
      for (const output of equivalentControls[id]!) {
        const result = assessOutput(output, state, original, "html");
        assert.equal(result.fullFidelity, true, JSON.stringify(result, null, 2));
        assert.equal(result.retention.overall.denominator, state.requirements.length);
        assert.deepEqual(result.requirements.map(item => item.id), state.requirements.map(item => item.id));
      }
    });
    test(`${id}: independent positive control retains every required item`, () => {
      const result = assessOutput(original, state, original, "html");
      assert.equal(result.fullFidelity, true, JSON.stringify(result, null, 2));
      assert.equal(result.outputBytes, Buffer.byteLength(original, "utf8"));
      assert.equal(result.outputKB, Buffer.byteLength(original, "utf8") / 1000);
    });

    test(`${id}: formatting changes do not redefine the ground truth`, () => {
      const equivalent = `<main>\n${original.replaceAll(
        "Acme Supplies", "<strong>Acme Supplies</strong>",
      )}\n</main>`;
      const result = assessOutput(equivalent, state, original, "html");
      assert.equal(
        result.fullFidelity,
        true,
        JSON.stringify(result, null, 2),
      );
    });

    test(`${id}: damaged control fails without consulting original evidence`, () => {
      const damaged = negativeControls[id]!;
      const result = assessOutput(damaged.output, state, original, "html");
      assert.equal(result.fullFidelity, false, `Expected loss of ${damaged.missingItem}`);
      assert.equal(result.requirements.find(item => item.id === damaged.missingItem)?.passed, false);
      assert.equal(assessOutput("", state, original, "html").fullFidelity, false);
    });

    test(`${id}: removing only chrome improves size, not the success denominator`, () => {
      const trimmed = original
        .replace(/<nav>[\s\S]*?<\/nav>/g, "")
        .replace(/<aside>[\s\S]*?<\/aside>/g, "")
        .replace(/<footer>[\s\S]*?<\/footer>/g, "");
      const result = assessOutput(trimmed, state, original, "html");
      assert.equal(result.fullFidelity, true, JSON.stringify(result, null, 2));
      assert.equal(result.retention.overall.denominator, state.requirements.length);
      assert.ok(result.outputBytes < Buffer.byteLength(original, "utf8"));
    });
  }
}

test("toolbars and popups cannot borrow action labels without the target association and enabled state", () => {
  const state = records.states.find(item => item.id === "target-actions-available")!;
  for (const output of wrongActionAssociations) {
    const result = assessOutput(output, state, positiveControls["records/target-actions-available"]!, "html");
    assert.equal(result.requirements.find(item => item.id === "view-request")?.passed, false);
  }
});
