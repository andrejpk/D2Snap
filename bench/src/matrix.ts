import { defineMatrix, type CellRegistration, type ImplementationPlan, type PresentationVariant, type Stack } from "./contracts.ts";
import { records } from "../cases/records.ts";
import { requestForm } from "../cases/request-form.ts";
import { requestDetail } from "../cases/request-detail.ts";

export { records, requestForm, requestDetail };

export const cases = [records, requestForm, requestDetail];

export const stacks: Stack[] = [
  { id: "react-shadcn", title: "React + shadcn/Radix", framework: "React", libraries: ["shadcn/ui", "Radix", "Tailwind"] },
  { id: "angular-primeng", title: "Angular + PrimeNG", framework: "Angular", libraries: ["PrimeNG"] },
  { id: "vue-vuetify", title: "Vue + Vuetify", framework: "Vue", libraries: ["Vuetify"] },
];

export const variants: PresentationVariant[] = [
  { id: "text-actions", title: "Direct text actions", description: "Prefer directly available, text-labeled controls." },
  { id: "icon-toolbar", title: "Icon toolbar", description: "Prefer named icon actions in contextual or selection-based toolbars." },
  { id: "overflow-actions", title: "Overflow actions", description: "Prefer compact action groups revealed when needed." },
];

// A sampling plan, not an intrinsic constraint on a framework or component library.
const initialVariants: Record<string, string> = {
  "react-shadcn": "icon-toolbar",
  "angular-primeng": "text-actions",
  "vue-vuetify": "overflow-actions",
};
export const implementations: ImplementationPlan[] = cases.flatMap(uxCase => stacks.map(stack => {
  const variantId = initialVariants[stack.id];
  if (!variantId) throw new Error(`Choose an initial presentation variant for ${stack.id}`);
  return { caseId: uxCase.id, stackId: stack.id, variantId };
}));
export const registrations: CellRegistration[] = [];
export const matrix = defineMatrix(cases, stacks, { variants, implementations }, registrations);
