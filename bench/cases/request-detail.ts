import { defineCase, type Requirement, type Scope } from "../src/contracts.ts";
import { alternative, base, controls, goal, page } from "./helpers.ts";

const summaryScopes: Scope[] = [
  { kind: "region", name: "Request summary" },
  { kind: "region", name: "Request details" },
];
const reviewScopes: Scope[] = [
  { kind: "dialog", name: "Approve request RQ-1042" },
  { kind: "region", name: "Review approval" },
];

const detailRequirements: Requirement[] = [
  goal("request-identity", "content", "Identify the request whose details are being read.",
    ...summaryScopes.map((scope, index) => alternative(`identity-${index}`, {
      kind: "text", scope, text: "Request RQ-1042",
    })),
  ),
  ...[
    { id: "supplier", label: "Supplier", value: "Acme Supplies" },
    { id: "amount", label: "Amount", value: "$1,200.00" },
    { id: "status", label: "Status", value: "Overdue" },
  ].map(field => goal(field.id, "content", `Read the request's ${field.id} with its label/value association.`,
    ...summaryScopes.map((scope, index) => alternative(`property-${index}`, {
      kind: "properties", scope, fields: [{ label: field.label, value: field.value }],
    })),
  )),
  goal("view-history", "control", "Access the history of the current request.",
    ...controls("history", { scope: page, roles: ["tab", "button", "link"], names: ["History", "Activity"], states: { disabled: false } }),
  ),
  goal("approve", "control", "Start approving the current request.",
    ...summaryScopes.flatMap((scope, index) => controls(`approve-${index}`, {
      scope, roles: ["button", "link"], names: ["Approve request", "Review approval"], states: { disabled: false },
    })),
    ...controls("approve-toolbar", {
      scope: { kind: "toolbar", name: "Actions for RQ-1042" },
      roles: ["button", "link"], names: ["Approve request", "Review approval"], states: { disabled: false },
    }),
  ),
];

export const requestDetail = defineCase({
  ...base,
  id: "request-detail",
  title: "Request detail and approval",
  task: "Read RQ-1042 and identify how to review, confirm or cancel its approval.",
  states: [
    {
      id: "details-available",
      revision: 2,
      description: "The current request's details and relevant actions are available, with or without tabs.",
      preparation: ["Reset and open RQ-1042.", "Make its request details available."],
      readyWhen: ["The request identity and facts are available together.", "History and approval affordances are available."],
      requirements: detailRequirements,
    },
    {
      id: "approval-review",
      revision: 2,
      description: "The request can be reviewed before confirming approval, in an overlay, inline section or separate view.",
      preparation: ["Prepare the details-available state.", "Start approval without confirming it."],
      readyWhen: ["The request being approved is identifiable.", "Confirmation and cancellation affordances are available."],
      requirements: [
        goal("confirmation", "content", "Read which request, supplier and amount will be approved.",
          ...reviewScopes.map((scope, index) => alternative(`sentence-${index}`, {
            kind: "text", scope, text: "Approve RQ-1042 for Acme Supplies, amount $1,200.00?",
          })),
          ...reviewScopes.map((scope, index) => alternative(`properties-${index}`, {
            kind: "properties", scope,
            fields: [
              { label: "Request", value: "RQ-1042" },
              { label: "Supplier", value: "Acme Supplies" },
              { label: "Amount", value: "$1,200.00" },
            ],
          })),
        ),
        goal("confirm", "control", "Confirm approval of the reviewed request.",
          ...reviewScopes.flatMap((scope, index) => controls(`confirm-${index}`, {
            scope, roles: ["button", "link"], names: ["Confirm approval", "Approve"], states: { disabled: false },
          })),
        ),
        goal("cancel", "control", "Leave the review without approving the request.",
          ...reviewScopes.flatMap((scope, index) => controls(`cancel-${index}`, {
            scope, roles: ["button", "link"], names: ["Cancel", "Go back"], states: { disabled: false },
          })),
        ),
      ],
    },
  ],
});
