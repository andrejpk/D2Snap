import { z } from "zod";

export const idSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
const revision = z.number().int().positive();

export const scopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page") }).strict(),
  z.object({ kind: z.literal("row"), anchor: text }).strict(),
  z.object({ kind: z.literal("region"), name: text }).strict(),
  z.object({ kind: z.literal("dialog"), name: text }).strict(),
  z.object({ kind: z.literal("toolbar"), name: text }).strict(),
  z.object({ kind: z.literal("selection-toolbar"), anchor: text }).strict(),
  z.object({ kind: z.literal("controlled-popup"), anchor: text }).strict(),
]);

export const controlStatesSchema = z.object({
  disabled: z.boolean().optional(),
  required: z.boolean().optional(),
  invalid: z.boolean().optional(),
  expanded: z.boolean().optional(),
  selected: z.boolean().optional(),
  checked: z.boolean().optional(),
}).strict();

export const evidenceRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    scope: scopeSchema,
    text,
  }).strict(),
  z.object({
    kind: z.literal("record"),
    scope: z.object({ kind: z.literal("row"), anchor: text }).strict(),
    fields: z.array(z.object({ label: text, value: text }).strict()).min(1),
  }).strict(),
  z.object({
    kind: z.literal("properties"),
    scope: scopeSchema,
    fields: z.array(z.object({ label: text, value: text }).strict()).min(1),
  }).strict(),
  z.object({
    kind: z.literal("control"),
    scope: scopeSchema,
    role: z.enum([
      "button", "link", "textbox", "searchbox", "combobox", "spinbutton",
      "checkbox", "radio", "switch", "tab", "menuitem", "option",
    ]),
    name: text,
    value: z.string().optional(),
    states: controlStatesSchema.optional(),
    description: text.optional(),
  }).strict(),
]);

export const evidenceAlternativeSchema = z.object({
  id: idSchema,
  allOf: z.array(evidenceRuleSchema).min(1),
}).strict().superRefine((alternative, context) => {
  for (const [index, rule] of alternative.allOf.entries()) {
    if (rule.kind === "record" || rule.kind === "properties") {
      checkUnique(rule.fields.map(field => field.label), context, ["allOf", index, "fields"]);
    }
  }
});

export const requirementSchema = z.object({
  id: idSchema,
  category: z.enum(["content", "control"]),
  goal: text,
  evidence: z.array(evidenceAlternativeSchema).min(1),
}).strict().superRefine((item, context) => {
  checkUnique(item.evidence.map(alternative => alternative.id), context, ["evidence"]);
  for (const [index, alternative] of item.evidence.entries()) {
    const hasControl = alternative.allOf.some(rule => rule.kind === "control");
    if ((item.category === "control") !== hasControl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Every control-goal alternative needs control evidence; content goals must not contain controls.",
        path: ["evidence", index, "allOf"],
      });
    }
  }
});

export const stateSchema = z.object({
  id: idSchema,
  revision,
  description: text,
  preparation: z.array(text).min(1),
  readyWhen: z.array(text).min(1),
  requirements: z.array(requirementSchema).min(1),
}).strict().superRefine((state, context) => {
  checkUnique(state.requirements.map(item => item.id), context, ["requirements"]);
});

export const caseSchema = z.object({
  schemaVersion: z.literal(2),
  id: idSchema,
  revision,
  title: text,
  task: text,
  datasetId: idSchema,
  datasetRevision: revision,
  excludedFromSuccess: z.array(text).min(1),
  states: z.array(stateSchema).min(1),
}).strict().superRefine((uxCase, context) => {
  checkUnique(uxCase.states.map(state => state.id), context, ["states"]);
});

export const stackSchema = z.object({
  id: idSchema,
  title: text,
  framework: text,
  libraries: z.array(text).min(1),
}).strict();

export const presentationVariantSchema = z.object({
  id: idSchema,
  title: text,
  description: text,
}).strict();

export const implementationPlanSchema = z.object({
  caseId: idSchema,
  stackId: idSchema,
  variantId: idSchema,
}).strict();

export const cellRegistrationSchema = implementationPlanSchema.extend({
  stateIds: z.array(idSchema).min(1),
  adapterModule: z.string().regex(/^\.\/[^\\]+\.ts$/, "Use a package-relative ./path.ts module."),
}).strict().superRefine((cell, context) => {
  checkUnique(cell.stateIds, context, ["stateIds"]);
  if (cell.adapterModule.split("/").includes("..")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "An adapter module cannot escape its stack package.",
      path: ["adapterModule"],
    });
  }
});

function checkUnique(
  ids: string[],
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  const seen = new Set<string>();
  for (const [index, id] of ids.entries()) {
    if (seen.has(id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate identity: ${id}`,
        path: [...path, index],
      });
    }
    seen.add(id);
  }
}

export type Scope = z.infer<typeof scopeSchema>;
export type EvidenceRule = z.infer<typeof evidenceRuleSchema>;
export type EvidenceAlternative = z.infer<typeof evidenceAlternativeSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type CaseState = z.infer<typeof stateSchema>;
export type UxCase = z.infer<typeof caseSchema>;
export type Stack = z.infer<typeof stackSchema>;
export type PresentationVariant = z.infer<typeof presentationVariantSchema>;
export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;
export type CellRegistration = z.infer<typeof cellRegistrationSchema>;

export interface MatrixCell {
  caseId: string;
  stackId: string;
  variantId: string;
  stateIds: string[];
  status: "planned" | "registered";
  adapterModule?: string;
}

export function defineCase(input: unknown): UxCase {
  return caseSchema.parse(input);
}

export function defineMatrix(
  caseInputs: unknown[],
  stackInputs: unknown[],
  planning: { variants: unknown[]; implementations: unknown[] },
  registrationInputs: unknown[] = [],
): MatrixCell[] {
  const cases = z.array(caseSchema).min(1).parse(caseInputs);
  const stacks = z.array(stackSchema).min(1).parse(stackInputs);
  const registrations = z.array(cellRegistrationSchema).parse(registrationInputs);
  const plan = z.object({
    variants: z.array(presentationVariantSchema).min(1),
    implementations: z.array(implementationPlanSchema).min(1),
  }).strict().parse(planning);
  assertUnique(cases.map(item => item.id), "case");
  assertUnique(stacks.map(item => item.id), "stack");
  assertUnique(plan.variants.map(item => item.id), "variant");
  const identity = (item: ImplementationPlan) => `${item.stackId}/${item.caseId}/${item.variantId}`;
  assertUnique(plan.implementations.map(identity), "implementation");
  assertUnique(registrations.map(identity), "registration");

  for (const implementation of plan.implementations) {
    if (!cases.some(item => item.id === implementation.caseId)
      || !stacks.some(item => item.id === implementation.stackId)
      || !plan.variants.some(item => item.id === implementation.variantId)) {
      throw new Error(`Unknown matrix axis in ${identity(implementation)}`);
    }
  }
  for (const uxCase of cases) {
    for (const stack of stacks) {
      if (!plan.implementations.some(item => item.caseId === uxCase.id && item.stackId === stack.id)) {
        throw new Error(`Missing implementation plan for ${stack.id}/${uxCase.id}`);
      }
    }
  }

  for (const registration of registrations) {
    const uxCase = cases.find(item => item.id === registration.caseId);
    if (!uxCase || !plan.implementations.some(item => identity(item) === identity(registration))) {
      throw new Error(`Unplanned implementation ${identity(registration)}`);
    }
    const expected = uxCase.states.map(state => state.id).sort();
    const actual = [...registration.stateIds].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new Error(`State coverage mismatch for ${identity(registration)}`);
    }
  }

  return plan.implementations.map(implementation => {
    const uxCase = cases.find(item => item.id === implementation.caseId)!;
    const registration = registrations.find(item => identity(item) === identity(implementation));
    return {
      ...implementation,
      stateIds: uxCase.states.map(state => state.id),
      status: registration ? "registered" : "planned",
      ...(registration ? { adapterModule: registration.adapterModule } : {}),
    };
  });
}

function assertUnique(ids: string[], label: string): void {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Duplicate ${label} identity`);
  }
}

/** A future Playwright adapter implements setup, never the oracle or scorer. */
export interface CellAdapter<BrowserPage> {
  caseId: string;
  stackId: string;
  variantId: string;
  prepare(page: BrowserPage, stateId: string): Promise<void>;
  assertReady(page: BrowserPage, stateId: string): Promise<void>;
}
