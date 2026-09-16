import { defineCase, type Requirement } from "../src/contracts.ts";
import { alternative, base, controls, goal, item, page } from "./helpers.ts";

function formRequirements(invalid: boolean): Requirement[] {
  return [
    goal("supplier", "control", "Choose a supplier and understand that it is required.",
      ...controls("select", { scope: page, roles: ["combobox"], names: ["Supplier"], states: { required: true } }),
      alternative("chooser",
        { kind: "control", scope: { kind: "region", name: "Supplier" }, role: "button", name: "Choose supplier", states: { disabled: false } },
        { kind: "text", scope: { kind: "region", name: "Supplier" }, text: "Required" },
      ),
    ),
    goal("cost-center", "control", "Choose a cost center and retain its current selection.",
      ...controls("select", { scope: page, roles: ["combobox"], names: ["Cost center"], value: "Operations" }),
      alternative("choices", {
        kind: "control", scope: { kind: "region", name: "Cost center" },
        role: "radio", name: "Operations", states: { checked: true },
      }),
    ),
    goal("amount", "control", "Enter the amount and retain its current value, required state and any associated error.",
      ...controls("amount", { scope: page, roles: ["spinbutton", "textbox"], names: ["Amount"], value: invalid ? "0" : "",
      states: { required: true, ...(invalid ? { invalid: true } : {}) },
      ...(invalid ? { description: "Amount must be greater than zero." } : {}),
      }),
    ),
    item("delivery-date", "Retain the date input and initialized date.", {
      kind: "control", scope: page, role: "textbox", name: "Requested delivery", value: "2026-06-30",
    }),
    item("justification", "Retain the justification input.", {
      kind: "control", scope: page, role: "textbox", name: "Justification", value: "",
    }),
    goal("submit", "control", "Submit the prepared request.",
      ...controls("submit", { scope: page, roles: ["button", "link"], names: ["Submit request", "Send request"], states: { disabled: false } }),
    ),
    ...(invalid ? [item("validation-summary", "Retain the visible validation explanation.", {
      kind: "text", scope: page, text: "Please correct the highlighted fields.",
    })] : []),
  ];
}

export const requestForm = defineCase({
  ...base,
  id: "request-form",
  title: "Create purchase request",
  task: "Identify the request fields, their current values and any validation errors.",
  states: [
    {
      id: "initialized",
      revision: 2,
      description: "A fresh request form with Operations and the seeded delivery date selected.",
      preparation: ["Reset the form.", "Set cost center to Operations and delivery to 2026-06-30."],
      readyWhen: ["Fields are rendered and the submit control is enabled.", "No validation error is displayed."],
      requirements: formRequirements(false),
    },
    {
      id: "validation-errors",
      revision: 2,
      description: "The amount is zero and an attempted submit displays validation feedback.",
      preparation: ["Prepare the initialized form.", "Enter amount 0 and submit without choosing a supplier."],
      readyWhen: ["Amount is marked invalid and linked to its error.", "The validation summary is visible."],
      requirements: formRequirements(true),
    },
  ],
});
