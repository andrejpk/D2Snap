import assert from "node:assert/strict";
import type { Page } from "playwright";
import type { CellAdapter } from "../../../src/contracts.ts";
import { dataset } from "@perception-bench/scenarios";

type State = "browsing" | "target-actions-available";

function supportedState(stateId: string): asserts stateId is State {
  if (stateId !== "browsing" && stateId !== "target-actions-available") {
    throw new Error(`svelte-bits/records/record-cards does not support state: ${stateId}`);
  }
}

/** Runner owns initial navigation, environment and capture; preparation only resets and interacts. */
export const recordsAdapter: CellAdapter<Page> = {
  caseId: "records",
  stackId: "svelte-bits",
  variantId: "record-cards",

  async prepare(page, stateId) {
    supportedState(stateId);
    await page.reload({ waitUntil: "load" });
    await page.getByRole("heading", { name: "Purchase requests", exact: true }).waitFor();
    await page.getByRole("region", { name: `Request ${dataset.requests.at(-1)!.id}`, exact: true }).waitFor();
    await recordsAdapter.assertReady(page, "browsing");
    if (stateId === "target-actions-available") {
      const target = page.getByRole("region", { name: "Request RQ-1042", exact: true });
      await target.getByRole("button", { name: "Actions for RQ-1042", exact: true }).click();
      await target.getByRole("menuitem", { name: "View request", exact: true }).waitFor();
    }
    await recordsAdapter.assertReady(page, stateId);
  },

  async assertReady(page, stateId) {
    supportedState(stateId);
    assert.equal(await page.getByRole("dialog").count(), 0, "No details or edit dialog may be open during observation");
    assert.equal(await page.getByRole("alert").count(), 0, "No client error may be present");
    const search = page.getByRole("searchbox", { name: "Search requests", exact: true });
    assert.equal(await search.isVisible(), true);
    assert.equal(await search.isEnabled(), true);
    assert.equal(await search.inputValue(), "", "Search must be empty");
    const filter = page.getByRole("combobox", { name: "Status", exact: true });
    assert.equal(await filter.isVisible(), true);
    assert.equal(await filter.isEnabled(), true);
    assert.equal(await filter.inputValue(), "All statuses");
    assert.deepEqual(await filter.locator("option").allTextContents(), [...dataset.statusFilters]);
    for (const choice of dataset.statusFilters) {
      const option = filter.getByRole("option", { name: choice, exact: true });
      assert.equal(await option.isEnabled(), true, `${choice} must be selectable`);
      assert.equal(await option.getAttribute("value"), choice);
    }

    const cards = page.getByRole("region", { name: /^Request RQ-/ });
    assert.equal(await cards.count(), dataset.requests.length, "All seeded requests, and no extras, must be rendered");
    for (const request of dataset.requests) {
      const card = page.getByRole("region", { name: `Request ${request.id}`, exact: true });
      assert.equal(await card.count(), 1, "Record names must be unique");
      assert.equal(await card.isVisible(), true);
      assert.equal(await card.getByRole("heading", { name: `Request ${request.id}`, exact: true }).count(), 1);
      const pairs = await card.locator("dl").evaluateAll(elements => elements.map(element => [
        element.querySelector("dt")?.textContent?.trim(),
        element.querySelector("dd")?.textContent?.trim(),
      ]));
      assert.deepEqual(pairs, [
        ["Supplier", request.supplier], ["Amount", request.amount],
        ["Status", request.status], ["Owner", request.owner],
      ], `${request.id} must preserve labeled seeded facts together`);
      const trigger = card.getByRole("button", { name: `Actions for ${request.id}`, exact: true });
      assert.equal(await trigger.isVisible(), true);
      assert.equal(await trigger.isEnabled(), true);
      const expanded: boolean = stateId === "target-actions-available" && request.id === "RQ-1042";
      assert.equal(await trigger.getAttribute("aria-expanded"), String(expanded));
      assert.equal(await card.getByRole("menu").count(), expanded ? 1 : 0);
    }

    assert.equal(await page.getByRole("menu").count(), stateId === "browsing" ? 0 : 1);
    if (stateId === "target-actions-available") {
      // Scope by the actual card, not a page-wide name or a benchmark-only marker.
      const card = page.getByRole("region", { name: "Request RQ-1042", exact: true });
      const menu = card.getByRole("menu");
      assert.equal(await menu.isVisible(), true);
      assert.equal(await menu.getByRole("menuitem").count(), 2);
      for (const name of ["View request", "Reassign owner"]) {
        const action = menu.getByRole("menuitem", { name, exact: true });
        assert.equal(await action.isVisible(), true, `${name} must remain inside its named request card`);
        assert.equal(await action.isEnabled(), true);
      }
    }
  },
};

export default recordsAdapter;
