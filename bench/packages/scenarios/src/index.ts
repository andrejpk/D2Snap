export const dataset = {
  id: "purchase-requests",
  revision: 1,
  seed: 1042,
  environment: {
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "UTC",
    clock: "2026-06-15T12:00:00.000Z",
    reducedMotion: "reduce",
  },
  requests: [
    { id: "RQ-1041", supplier: "Acme Supplies", amount: "$2,400.00", status: "Approved", owner: "Jamie Chen" },
    { id: "RQ-1042", supplier: "Acme Supplies", amount: "$1,200.00", status: "Overdue", owner: "Morgan Lee" },
    { id: "RQ-1043", supplier: "Northwind Services", amount: "$1,200.00", status: "Pending", owner: "Jamie Chen" },
  ],
  suppliers: ["Acme Supplies", "Northwind Services", "Contoso Parts"],
  costCenters: ["Operations", "Engineering", "Finance"],
  statusFilters: ["All statuses", "Pending", "Overdue", "Approved"],
  chrome: {
    brand: "Procurement workspace",
    navigation: ["Overview", "Requests", "Reports", "Help"],
    footer: "Terms | Privacy | Service status",
    announcement: "Read the latest procurement policy in the help center.",
  },
} as const;

export type ScenarioDataset = typeof dataset;
