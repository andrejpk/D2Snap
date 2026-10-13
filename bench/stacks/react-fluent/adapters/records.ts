import assert from "node:assert/strict";
import type { Page } from "playwright";
import type { CellAdapter } from "../../../src/contracts.ts";
import { dataset } from "@perception-bench/scenarios";

type State = "browsing" | "target-actions-available";
function supportedState(stateId: string): asserts stateId is State {
  if (stateId !== "browsing" && stateId !== "target-actions-available") {
    throw new Error(`react-fluent/records/selection-toolbar does not support state: ${stateId}`);
  }
}

/** Setup/readiness only. The runner owns the server, URL, environment and capture. */
export const recordsAdapter: CellAdapter<Page> = {
  caseId: "records",
  stackId: "react-fluent",
  variantId: "selection-toolbar",

  async prepare(page, stateId) {
    supportedState(stateId);
    await page.reload({ waitUntil: "load" });
    await page.getByRole("heading", { name: "Purchase requests", exact: true }).waitFor();
    await page.getByRole("gridcell", { name: dataset.requests.at(-1)!.id, exact: true }).waitFor();
    await recordsAdapter.assertReady(page, "browsing");
    if (stateId === "target-actions-available") {
      await page.getByRole("radio", { name: "Select RQ-1042", exact: true }).check();
      await page.getByRole("toolbar", { name: "Actions for RQ-1042", exact: true }).waitFor();
      await page.getByRole("row", { selected: true }).waitFor();
    }
    await recordsAdapter.assertReady(page, stateId);
  },

  async assertReady(page, stateId) {
    supportedState(stateId);
    assert.equal(await page.getByRole("alert").count(), 0, "No client error may be displayed");
    assert.equal(await page.getByRole("dialog").count(), 0, "Dialogs must be closed for observation");
    const search = page.getByRole("searchbox", { name: "Search requests", exact: true });
    assert.equal(await search.count(), 1);
    assert.equal(await search.isVisible(), true);
    assert.equal(await search.isEnabled(), true, "Search must be enabled");
    assert.equal(await search.inputValue(), "", "Search must be empty");
    const filter = page.getByRole("combobox", { name: "Status", exact: true });
    assert.equal(await filter.count(), 1);
    assert.equal(await filter.isVisible(), true);
    assert.equal(await filter.isEnabled(), true, "Filter must be enabled");
    assert.equal(await filter.inputValue(), "All statuses");
    assert.deepEqual(await filter.locator("option").allTextContents(), [...dataset.statusFilters]);
    for (const label of dataset.statusFilters) {
      const option = filter.locator("option").filter({ hasText: new RegExp(`^${label}$`) });
      assert.equal(await option.isEnabled(), true, `${label} must be an enabled retained choice`);
      assert.equal(await option.getAttribute("value"), label);
    }
    assert.deepEqual(await filter.locator("option:checked").allTextContents(), ["All statuses"]);
    assert.equal(await page.getByRole("button", { name: "Reset workspace", exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole("button", { name: "Reset filters", exact: true }).isEnabled(), true);

    const grid = page.getByRole("grid", { name: "Purchase requests", exact: true });
    assert.equal(await grid.count(), 1, "Exactly one named request grid");
    assert.equal(await grid.isVisible(), true);
    assert.equal(await grid.getByRole("row").count(), dataset.requests.length + 1, "All three records and their header must be mounted");
    const columns = ["request", "supplier", "amount", "status", "owner"];
    const labels = ["Request", "Supplier", "Amount", "Status", "Owner"];
    for (const [index, column] of columns.entries()) {
      const header = grid.getByRole("columnheader", { name: labels[index]!, exact: true });
      assert.equal(await header.count(), 1);
      assert.equal(await header.getAttribute("id"), `column-${column}`);
      assert.equal(await page.locator(`[id="column-${column}"]`).count(), 1, "Column association must resolve unambiguously");
    }
    for (const record of dataset.requests) {
      const row = grid.getByRole("row").filter({ has: page.getByRole("gridcell", { name: record.id, exact: true }) });
      assert.equal(await row.count(), 1, `${record.id} must have one row`);
      assert.equal(await row.isVisible(), true);
      const cells = row.locator('[role="gridcell"][aria-describedby^="column-"]');
      const facts = await cells.evaluateAll(elements => elements.map(cell => {
        const copy = cell.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('[aria-hidden="true"]').forEach(hidden => hidden.remove());
        return copy.textContent?.replace(/\s+/g, " ").trim() ?? "";
      }));
      assert.deepEqual(facts, [record.id, record.supplier, record.amount, record.status, record.owner], `${record.id} facts and column order`);
      assert.deepEqual(await cells.evaluateAll(elements => elements.map(cell => cell.getAttribute("aria-describedby"))), columns.map(column => `column-${column}`), "Cells must preserve their header associations");
      const selection = row.getByRole("radio", { name: `Select ${record.id}`, exact: true });
      assert.equal(await selection.isVisible(), true);
      assert.equal(await selection.isEnabled(), true);
      const expected: boolean = stateId === "target-actions-available" && record.id === "RQ-1042";
      assert.equal(await selection.isChecked(), expected, `${record.id} selection control`);
      assert.equal(await row.getAttribute("aria-selected"), String(expected), `${record.id} selected-row state`);
    }

    if (stateId === "browsing") {
      assert.equal(await grid.getByRole("row", { selected: true }).count(), 0);
      assert.equal(await page.getByRole("toolbar").count(), 0, "No contextual toolbar before selection");
      return;
    }
    assert.equal(await grid.getByRole("row", { selected: true }).count(), 1, "The target must be the sole selection");
    assert.equal(await page.getByRole("toolbar").count(), 1);
    const toolbar = page.getByRole("toolbar", { name: "Actions for RQ-1042", exact: true });
    assert.equal(await toolbar.isVisible(), true);
    const gridId = await grid.getAttribute("id");
    assert.ok(gridId);
    assert.equal(await page.locator(`[id="${gridId}"]`).count(), 1);
    assert.equal(await toolbar.getAttribute("aria-controls"), gridId, "Contextual actions control the selected row's grid");
    assert.equal(await toolbar.getByText("RQ-1042 selected", { exact: true }).isVisible(), true);
    for (const name of ["View request", "Reassign owner", "Clear selection"]) {
      const button = toolbar.getByRole("button", { name, exact: true });
      assert.equal(await button.count(), 1);
      assert.equal(await button.isVisible(), true);
      assert.equal(await button.isEnabled(), true, `${name} must be enabled`);
    }
  },
};

export default recordsAdapter;
