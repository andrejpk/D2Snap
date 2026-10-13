import assert from "node:assert/strict";
import type { Page } from "playwright";
import type { CellAdapter } from "../../../src/contracts.ts";
import { dataset } from "@perception-bench/scenarios";

type State = "browsing" | "target-actions-available";
function supportedState(stateId: string): asserts stateId is State {
  if (stateId !== "browsing" && stateId !== "target-actions-available") {
    throw new Error(`vue-primevue/records/overflow-actions does not support state: ${stateId}`);
  }
}

/** Setup only: the runner owns initial navigation, environment, capture and scoring. */
export const recordsAdapter: CellAdapter<Page> = {
  caseId: "records",
  stackId: "vue-primevue",
  variantId: "overflow-actions",

  async prepare(page, stateId) {
    supportedState(stateId);
    // No persistence: reload resets filters, edits, dialogs and per-row popup state.
    await page.reload({ waitUntil: "load" });
    await page.getByRole("heading", { name: "Purchase requests", exact: true }).waitFor();
    await page.getByRole("cell", { name: dataset.requests.at(-1)!.id, exact: true }).waitFor();
    await recordsAdapter.assertReady(page, "browsing");
    if (stateId === "target-actions-available") {
      const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "RQ-1042", exact: true }) });
      await row.getByRole("button", { name: "Actions for RQ-1042", exact: true }).click();
      await page.locator('[id="request-actions-RQ-1042"]').waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector('button[aria-controls="request-actions-RQ-1042"]')?.getAttribute("aria-expanded") === "true");
    }
    await recordsAdapter.assertReady(page, stateId);
  },

  async assertReady(page, stateId) {
    supportedState(stateId);
    assert.equal(await page.getByRole("alert").count(), 0, "No client error alert");
    assert.equal(await page.getByRole("dialog").count(), 0, "No open dialog in either observation state");
    const search = page.getByRole("searchbox", { name: "Search requests", exact: true });
    assert.equal(await search.isVisible(), true);
    assert.equal(await search.isEnabled(), true, "Search must be enabled");
    assert.equal(await search.inputValue(), "", "Search must be empty");
    const filter = page.getByRole("combobox", { name: "Status", exact: true });
    assert.equal(await filter.isVisible(), true);
    assert.equal(await filter.isEnabled(), true, "Status filter must be enabled");
    assert.equal(await filter.inputValue(), "All statuses");
    const options = filter.locator("option");
    assert.deepEqual(await options.allTextContents(), [...dataset.statusFilters]);
    assert.deepEqual(await options.evaluateAll(elements => elements.map(element => ({
      value: (element as HTMLOptionElement).value,
      selected: (element as HTMLOptionElement).selected,
      disabled: (element as HTMLOptionElement).disabled,
    }))), dataset.statusFilters.map(value => ({ value, selected: value === "All statuses", disabled: false })));
    for (const choice of dataset.statusFilters) {
      assert.equal(await filter.getByRole("option", { name: choice, exact: true }).isEnabled(), true);
    }

    const table = page.getByRole("table", { name: "Purchase requests", exact: true });
    assert.equal(await table.count(), 1);
    assert.equal(await table.isVisible(), true);
    assert.deepEqual((await table.getByRole("columnheader").allTextContents()).map(text => text.trim()), [
      "Request", "Supplier", "Amount", "Status", "Owner", "Actions",
    ], "Real table headers must associate the record facts");
    const rows = table.locator("tbody > tr");
    assert.equal(await rows.count(), dataset.requests.length, "All three records must be rendered");
    for (const [index, record] of dataset.requests.entries()) {
      const row = rows.nth(index);
      assert.equal(await row.isVisible(), true);
      const cells = row.getByRole("cell");
      assert.equal(await cells.count(), 6);
      for (const [column, fact] of [record.id, record.supplier, record.amount, record.status, record.owner].entries()) {
        assert.equal(await cells.nth(column).isVisible(), true, `${record.id} fact must be visible`);
        assert.equal((await cells.nth(column).innerText()).trim(), fact, `${record.id} column ${column}`);
      }
      const trigger = row.getByRole("button", { name: `Actions for ${record.id}`, exact: true });
      assert.equal(await trigger.isVisible(), true);
      assert.equal(await trigger.isEnabled(), true);
      const expanded: boolean = stateId === "target-actions-available" && record.id === "RQ-1042";
      assert.equal(await trigger.getAttribute("aria-expanded"), String(expanded));
      assert.equal(await trigger.getAttribute("aria-haspopup"), "menu");
      const popupId = await trigger.getAttribute("aria-controls");
      assert.ok(popupId, "Every row trigger controls its own popup");
      assert.equal(popupId, `request-actions-${record.id}`);
      const popup = page.locator(`[id="${popupId}"]`);
      if (expanded) {
        assert.equal(await popup.count(), 1, "Controlled popup ID must be unique");
        assert.equal(await popup.isVisible(), true, "Target-linked popup must be visible");
        for (const name of ["View request", "Reassign owner"]) {
          const action = popup.getByRole("menuitem", { name, exact: true });
          assert.equal(await action.count(), 1, `${name} must be unambiguous within the target popup`);
          assert.equal(await action.isVisible(), true);
          assert.equal(await action.isEnabled(), true);
          assert.equal(await page.getByRole("menuitem", { name, exact: true }).count(), 1, "No competing row popup");
        }
      } else {
        assert.equal(await popup.isVisible(), false, "Other row popups must be closed");
      }
    }
    if (stateId === "browsing") {
      assert.equal(await page.getByRole("menuitem").count(), 0, "Browsing does not expose contextual actions");
    }
  },
};

export default recordsAdapter;
