import { defineMatrix, type CellRegistration, type ImplementationPlan, type PresentationVariant, type Stack } from "./contracts.ts";
import { records } from "../cases/records.ts";
import { requestForm } from "../cases/request-form.ts";
import { requestDetail } from "../cases/request-detail.ts";

export { records, requestForm, requestDetail };

export const cases = [records, requestForm, requestDetail];

export const stacks: Stack[] = [
  { id: "react-shadcn", title: "React + shadcn/Radix", framework: "React", libraries: ["shadcn/ui table (CSS-adapted)", "Radix"] },
  { id: "angular-primeng", title: "Angular + PrimeNG", framework: "Angular", libraries: ["PrimeNG"] },
  { id: "vue-vuetify", title: "Vue + Vuetify", framework: "Vue", libraries: ["Vuetify"] },
  { id: "angular-material-ag-grid", title: "Angular + Material + AG Grid Community", framework: "Angular", libraries: ["Angular Material", "AG Grid Community"] },
  { id: "react-fluent", title: "React + Fluent UI v9", framework: "React", libraries: ["Fluent UI v9"] },
  { id: "vue-primevue", title: "Vue + PrimeVue", framework: "Vue", libraries: ["PrimeVue"] },
  { id: "svelte-bits", title: "Svelte + Bits UI + Tailwind", framework: "Svelte", libraries: ["Bits UI", "Tailwind CSS"] },
];

export const variants: PresentationVariant[] = [
  { id: "text-actions", title: "Direct text actions", description: "Prefer directly available, text-labeled controls." },
  { id: "icon-toolbar", title: "Icon toolbar", description: "Prefer named icon actions in contextual or selection-based toolbars." },
  { id: "overflow-actions", title: "Overflow actions", description: "Prefer compact action groups revealed when needed." },
  { id: "selection-toolbar", title: "Selection toolbar", description: "Enterprise grid/list with actions for a selected record." },
  { id: "record-cards", title: "Record cards", description: "Named record cards with locally associated contextual actions." },
];

// A sampling plan, not an intrinsic constraint on a framework or component library.
const initialVariants: Record<string, string> = {
  "react-shadcn": "icon-toolbar",
  "angular-primeng": "text-actions",
  "vue-vuetify": "overflow-actions",
  "angular-material-ag-grid": "selection-toolbar",
  "react-fluent": "selection-toolbar",
  "vue-primevue": "overflow-actions",
  "svelte-bits": "record-cards",
};
export const implementations: ImplementationPlan[] = cases.flatMap(uxCase => stacks.map(stack => {
  const variantId = initialVariants[stack.id];
  if (!variantId) throw new Error(`Choose an initial presentation variant for ${stack.id}`);
  return { caseId: uxCase.id, stackId: stack.id, variantId };
}));
export const registrations: CellRegistration[] = [{
  caseId: "records", stackId: "react-shadcn", variantId: "icon-toolbar",
  stateIds: ["browsing", "target-actions-available"], adapterModule: "./adapters/records.ts",
}, ...[
  ["angular-material-ag-grid", "selection-toolbar"], ["react-fluent", "selection-toolbar"],
  ["vue-primevue", "overflow-actions"], ["svelte-bits", "record-cards"],
].map(([stackId, variantId]) => ({
  caseId: "records", stackId: stackId!, variantId: variantId!,
  stateIds: ["browsing", "target-actions-available"], adapterModule: "./adapters/records.ts",
}))];
export const matrix = defineMatrix(cases, stacks, { variants, implementations }, registrations);
