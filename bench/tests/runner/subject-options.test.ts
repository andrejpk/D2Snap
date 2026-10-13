import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GROUND_TRUTH } from "../../../src/var.GROUND_TRUTH.ts";
import { planSchema } from "../../src/runner/models.ts";
import { subjectOptions } from "../../src/runner/subject-options.ts";

const plan = planSchema.parse(JSON.parse(readFileSync(new URL("../../configs/poc.json", import.meta.url), "utf8")));

test("bench options map explicitly onto the rebased library API without changing shared defaults", () => {
  const before = structuredClone(plan.options);
  const defaults = structuredClone(GROUND_TRUTH);
  const mapped = subjectOptions(plan.options);
  assert.equal(mapped.groundTruthReplaceDefault, true);
  assert.deepEqual(mapped.groundTruth?.typeAttribute, {
    ratings: plan.options.attributeScoring, fallbackRating: plan.options.attributeScoringFallback,
  });
  assert.deepEqual(mapped.groundTruth?.typeElement?.container, GROUND_TRUTH.typeElement.container);
  assert.deepEqual(mapped.groundTruth?.typeElement?.actionable, GROUND_TRUTH.typeElement.actionable);
  assert.deepEqual(mapped.groundTruth?.typeElement?.replaceWithLabel?.tagNames, ["img", "svg"]);
  assert.deepEqual(mapped.groundTruth?.typeElement?.replaceWithLabel?.classPatterns, []);
  assert.equal("attributeScoring" in mapped, false);
  assert.equal("liftImageDescription" in mapped, false);
  assert.deepEqual(plan.options, before);
  assert.deepEqual(GROUND_TRUTH, defaults);
});

test("image-label opt-out and absent attribute defaults are handled explicitly", () => {
  assert.deepEqual(subjectOptions({ ...plan.options, liftImageDescription: false })
    .groundTruth?.typeElement?.replaceWithLabel?.tagNames, []);
  const missing = { ...plan.options.attributeScoring };
  delete missing["aria-*"];
  assert.throws(() => subjectOptions({ ...plan.options, attributeScoring: missing }), /omits subject attribute defaults/);
});
