import assert from "node:assert/strict";
import type { Page } from "playwright";
import type { CellAdapter } from "../../../src/contracts.ts";
import { dataset } from "@perception-bench/scenarios";

type State = "browsing" | "target-actions-available";

function supportedState(stateId: string): asserts stateId is State {
  if (stateId !== "browsing" && stateId !== "target-actions-available") {
    throw new Error(`react-shadcn/records/icon-toolbar does not support state: ${stateId}`);
  }
}

/** The runner owns server startup, navigation, environment, capture and scoring. */
export const recordsAdapter: CellAdapter<Page> = {
  caseId: "records",
  stackId: "react-shadcn",
  variantId: "icon-toolbar",

  async prepare(page, stateId) {
    supportedState(stateId);
    // React state is deliberately in-memory. Reload also clears dialogs and edits.
    await page.reload({ waitUntil: "load" });
    await page.getByRole("heading", { name: "Purchase requests", exact: true }).waitFor();
    await page.getByRole("cell", { name: dataset.requests[dataset.requests.length - 1]!.id, exact: true }).waitFor();
    await recordsAdapter.assertReady(page, "browsing");
    if (stateId === "target-actions-available") {
      await page.getByRole("checkbox", { name: "Select RQ-1042", exact: true }).check();
      await page.getByRole("toolbar", { name: "Request actions", exact: true }).waitFor();
    }
    await recordsAdapter.assertReady(page, stateId);
  },

  async assertReady(page, stateId) {
    supportedState(stateId);
    assert.equal(await page.getByRole("alert").count(), 0, "The client must not report an error");
    assert.equal(await page.getByRole("dialog").count(), 0, "Observation states must not contain an open dialog");
    const search = page.getByRole("searchbox", { name: "Search requests", exact: true });
    assert.equal(await search.isVisible(), true, "Query control must be visible");
    assert.equal(await search.inputValue(), "", "Query must be empty");
    const filter = page.getByRole("combobox", { name: "Status", exact: true });
    assert.equal(await filter.isVisible(), true, "Status filter must be visible");
    assert.equal(await filter.inputValue(), "All statuses", "Status filter must be reset");
    assert.deepEqual(await filter.locator("option").allTextContents(), [...dataset.statusFilters]);

    const table = page.getByRole("table", { name: /^Purchase requests ·/ });
    assert.equal(await table.count(), 1, "Exactly one request table must be present");
    assert.equal(await table.isVisible(), true);
    assert.deepEqual(await table.getByRole("columnheader").allTextContents(), [
      "Select", "Request", "Supplier", "Amount", "Status", "Owner",
    ], "Table headers must preserve fact associations");
    const rows = table.locator("tbody > tr");
    assert.equal(await rows.count(), dataset.requests.length, "All seeded records, and no extras, must be rendered");
    const facts = await rows.evaluateAll(elements => elements.map(row =>
      Array.from(row.querySelectorAll("td")).map(cell => {
        const copy = cell.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('[aria-hidden="true"]').forEach(hidden => hidden.remove());
        return copy.textContent?.replace(/\s+/g, " ").trim() ?? "";
      }),
    ));
    assert.deepEqual(facts, dataset.requests.map(record => [
      "", record.id, record.supplier, record.amount, record.status, record.owner,
    ]), "Every seeded row must retain its exact identifying facts and ordering");
    for (const record of dataset.requests) {
      const row = rows.filter({ has: page.getByRole("cell", { name: record.id, exact: true }) });
      const checkbox = row.getByRole("checkbox", { name: `Select ${record.id}`, exact: true });
      assert.equal(await checkbox.isVisible(), true, `${record.id} must be selectable`);
      assert.equal(await checkbox.isEnabled(), true);
      const expectedSelected: boolean = stateId === "target-actions-available" && record.id === "RQ-1042";
      assert.equal(await row.getAttribute("aria-selected"), String(expectedSelected), `${record.id} selection`);
      assert.equal(await checkbox.isChecked(), expectedSelected, `${record.id} selection control`);
    }

    const toolbars = page.getByRole("toolbar");
    if (stateId === "browsing") {
      assert.equal(await table.getByRole("row", { selected: true }).count(), 0);
      assert.equal(await toolbars.count(), 0, "Browsing starts without contextual actions");
      return;
    }
    assert.equal(await table.getByRole("row", { selected: true }).count(), 1, "Only the target may be selected");
    assert.equal(await toolbars.count(), 1, "Exactly one contextual toolbar must be visible");
    const toolbar = page.getByRole("toolbar", { name: "Request actions", exact: true });
    const tableId = await table.getAttribute("id");
    assert.ok(tableId, "The request table needs a normal document id");
    assert.equal(await toolbar.getAttribute("aria-controls"), tableId, "Toolbar must control the selected row's table");
    assert.equal(await page.locator(`[id="${tableId}"]`).count(), 1, "Toolbar association must be unambiguous");
    for (const name of ["View request", "Reassign owner"]) {
      const action = toolbar.getByRole("button", { name, exact: true });
      assert.equal(await action.isVisible(), true, `${name} must be visible`);
      assert.equal(await action.isEnabled(), true, `${name} must be enabled`);
    }
  },
};

export default recordsAdapter;
