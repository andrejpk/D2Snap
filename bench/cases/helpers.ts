import type { EvidenceAlternative, EvidenceRule, Requirement } from "../src/contracts.ts";
import { dataset } from "@perception-bench/scenarios";

export function item(id: string, goal: string, rule: EvidenceRule): Requirement {
  return {
    id, goal, category: rule.kind === "control" ? "control" : "content",
    evidence: [alternative("standard", rule)],
  };
}

export function alternative(id: string, ...allOf: EvidenceRule[]): EvidenceAlternative {
  return { id, allOf };
}

export function goal(
  id: string,
  category: Requirement["category"],
  description: string,
  ...evidence: EvidenceAlternative[]
): Requirement {
  return { id, category, goal: description, evidence };
}

type Control = Extract<EvidenceRule, { kind: "control" }>;

export function controls(
  id: string,
  expression: Omit<Control, "kind" | "role" | "name"> & {
    roles: Control["role"][];
    names: string[];
  },
): EvidenceAlternative[] {
  const { roles, names, ...common } = expression;
  return roles.flatMap(role => names.map((name, index) => alternative(`${id}-${role}-${index}`, {
    kind: "control", ...common, role, name,
  })));
}

export const page = { kind: "page" } as const;
export const base = {
  schemaVersion: 2,
  revision: 2,
  datasetId: dataset.id,
  datasetRevision: dataset.revision,
  excludedFromSuccess: [
    "Global navigation, announcements, help links, footer and decorative icons",
    "Unrelated record values and unrelated actions",
    "Controls or content not rendered in the selected state",
  ],
} as const;
