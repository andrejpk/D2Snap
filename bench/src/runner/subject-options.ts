import { GROUND_TRUTH } from "../../../src/var.GROUND_TRUTH.ts";
import type { Plan } from "./models.ts";

/** Translate the bench's explicit options to the API at the selected library revision. */
export function subjectOptions(options: Plan["options"]) {
  const { attributeScoring, attributeScoringFallback, liftImageDescription, ...shared } = options;
  const missing = Object.keys(GROUND_TRUTH.typeAttribute.ratings).filter(key => !(key in attributeScoring));
  if (missing.length) throw new Error(`Configuration omits subject attribute defaults: ${missing.join(", ")}`);
  return {
    ...shared,
    groundTruthReplaceDefault: true,
    groundTruth: {
      ...GROUND_TRUTH,
      typeElement: {
        ...GROUND_TRUTH.typeElement,
        replaceWithLabel: {
          tagNames: liftImageDescription ? ["img", "svg"] : [],
          labelAttrs: ["aria-label", "title", "alt"],
          labelChildTags: ["title", "desc"],
          classPatterns: [],
        },
      },
      typeAttribute: { ratings: { ...attributeScoring }, fallbackRating: attributeScoringFallback },
    },
  };
}
