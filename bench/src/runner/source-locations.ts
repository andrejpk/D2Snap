import { JSDOM } from "jsdom";
import { inspectEvidence } from "../evidence/index.ts";
import type { Assessment } from "../evidence/index.ts";
import type { CaseState } from "../contracts.ts";
import type { SourceHighlight, SourceRange } from "./viewer-model.ts";

/** Temporary origin markers link the existing inspector's nodes to unmodified source offsets. */
export function locateSource(output: string, state: CaseState, assessment: Assessment): Record<string, SourceHighlight> {
  const source = new JSDOM(output, { includeNodeLocations: true });
  let inspected: JSDOM | undefined;
  try {
    let attribute = "data-bench-source-origin";
    while (output.toLowerCase().includes(attribute)) attribute += "-x";
    const ranges = new Map<string, SourceRange>();
    const insertions: { at: number; text: string }[] = [];
    for (const element of source.window.document.querySelectorAll("*")) {
      const location = source.nodeLocation(element);
      if (!location || location.startOffset < 0) continue;
      const opening = output.slice(location.startOffset).match(/^<[a-zA-Z][^\s/>]*/);
      if (!opening) continue;
      const id = String(ranges.size);
      ranges.set(id, { from: location.startOffset, to: location.endOffset });
      insertions.push({ at: location.startOffset + opening[0].length, text: ` ${attribute}="${id}"` });
    }
    let annotated = output;
    for (const insertion of insertions.sort((a, b) => b.at - a.at)) {
      annotated = annotated.slice(0, insertion.at) + insertion.text + annotated.slice(insertion.at);
    }
    const inspection = inspectEvidence(annotated, state, assessment);
    inspected = new JSDOM(inspection.html);
    const document = inspected.window.document;
    return Object.fromEntries(state.requirements.map(requirement => {
      const highlight = inspection.highlights[requirement.id]!;
      const verdict = assessment.requirements.find(item => item.id === requirement.id)!;
      let containingBlock = false;
      const located = highlight.selectors.flatMap(selector => {
        const target = document.querySelector(selector);
        const origin = target?.closest(`[${attribute}]`);
        const range = ranges.get(origin?.getAttribute(attribute) ?? "");
        if (!range) return [];
        if (origin !== target) containingBlock = true;
        return [range];
      });
      const unique = [...new Map(located.map(range => [`${range.from}:${range.to}`, range])).values()];
      const kind = !unique.length ? "none" : containingBlock ? "context" : highlight.kind;
      return [requirement.id, {
        ranges: unique, kind, provenance: verdict.match,
        explanation: !unique.length ? "No matching or context source location is available for this goal."
          : containingBlock ? "Containing source block only; the exact rendered element is synthesized from Markdown."
            : highlight.kind === "context" ? "Context only, not a successful goal match."
              : verdict.match === "inferred" ? "Source supporting a deterministically inferred match."
                : "Source supporting an explicit match.",
      } satisfies SourceHighlight];
    }));
  } finally {
    source.window.close();
    inspected?.window.close();
  }
}
