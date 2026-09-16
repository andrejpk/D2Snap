import { defineCase, type EvidenceAlternative, type Requirement } from "../src/contracts.ts";
import { alternative, base, controls, goal, page } from "./helpers.ts";

const targetRow = { kind: "row", anchor: "RQ-1042" } as const;
const targetCard = { kind: "region", name: "Request RQ-1042" } as const;

function recordAction(names: string[]): EvidenceAlternative[] {
  return [
    ...controls("row", { scope: targetRow, roles: ["button", "link", "menuitem"], names, states: { disabled: false } }),
    ...controls("card", { scope: targetCard, roles: ["button", "link", "menuitem"], names, states: { disabled: false } }),
    ...controls("named-toolbar", {
      scope: { kind: "toolbar", name: "Actions for RQ-1042" },
      roles: ["button", "link", "menuitem"], names, states: { disabled: false },
    }),
    ...controls("selected-toolbar", {
      scope: { kind: "selection-toolbar", anchor: "RQ-1042" },
      roles: ["button", "link", "menuitem"], names, states: { disabled: false },
    }),
    ...controls("popup", {
      scope: { kind: "controlled-popup", anchor: "RQ-1042" },
      roles: ["button", "link", "menuitem"], names, states: { disabled: false },
    }),
    ...controls("named-actions", {
      scope: { kind: "region", name: "Actions for RQ-1042" },
      roles: ["button", "link", "menuitem"], names, states: { disabled: false },
    }),
  ];
}

const recordRequirements: Requirement[] = [
  goal("request-facts", "content", "Identify RQ-1042 and retain its supplier, amount, status and owner together.",
    alternative("table", {
      kind: "record", scope: targetRow,
      fields: [
        { label: "Supplier", value: "Acme Supplies" },
        { label: "Amount", value: "$1,200.00" },
        { label: "Status", value: "Overdue" },
        { label: "Owner", value: "Morgan Lee" },
      ],
    }),
    alternative("card", {
      kind: "properties", scope: targetCard,
      fields: [
        { label: "Supplier", value: "Acme Supplies" },
        { label: "Amount", value: "$1,200.00" },
        { label: "Status", value: "Overdue" },
        { label: "Owner", value: "Morgan Lee" },
      ],
    }),
  ),
  goal("search", "control", "Find requests using a query and retain the current query.",
    ...controls("search", { scope: page, roles: ["textbox", "searchbox"], names: ["Search requests", "Find requests"], value: "" }),
  ),
  goal("status-filter", "control", "Restrict requests by status and retain the current selection.",
    ...controls("select", { scope: page, roles: ["combobox"], names: ["Status", "Filter by status"], value: "All statuses" }),
    alternative("all-statuses-option", {
      kind: "control", scope: { kind: "region", name: "Filter by status" },
      role: "radio", name: "All statuses", states: { checked: true },
    }),
  ),
];

export const records = defineCase({
  ...base,
  id: "records",
  title: "Browse purchase requests",
  task: "Find overdue request RQ-1042 and identify the actions available for that request.",
  states: [
    {
      id: "browsing",
      revision: 2,
      description: "The request collection and its search/filter affordances are available.",
      preparation: ["Reset the app and load the shared request dataset.", "Show all statuses with an empty query."],
      readyWhen: ["The seeded requests are rendered with their identifying facts.", "Search and the current status filter are available."],
      requirements: recordRequirements,
    },
    {
      id: "target-actions-available",
      revision: 2,
      description: "The view and owner-reassignment actions for RQ-1042 are available, regardless of their presentation.",
      preparation: [
        "Prepare the browsing state.",
        "Make RQ-1042's actions available: select it, reveal its actions, or use already-visible controls as appropriate.",
      ],
      readyWhen: [
        "The view and reassignment affordances are available.",
        "The output establishes that both actions apply to RQ-1042, not another request.",
      ],
      requirements: [
        ...recordRequirements,
        goal("view-request", "control", "Access the details of RQ-1042.", ...recordAction(["View request", "Open request", "View details"])),
        goal("reassign-owner", "control", "Change the owner of RQ-1042.", ...recordAction(["Reassign owner", "Change owner"])),
      ],
    },
  ],
});
