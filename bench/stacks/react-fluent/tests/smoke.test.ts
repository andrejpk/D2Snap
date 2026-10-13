import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import { startServer } from "../../../src/runner/server.ts";
import { fixtureFiles } from "./fixture-files.ts";
import { dataset } from "@perception-bench/scenarios";
import adapter from "../adapters/records.ts";

test("Fluent records: states, filters, dialogs, local reassignment and reset", async () => {
  const server = process.env.FLUENT_FIXTURE_URL ? undefined : await startServer(await fixtureFiles());
  const fixtureUrl = process.env.FLUENT_FIXTURE_URL ?? `${server!.url}/fixture/?clawpilotTheme=light`;
  const url = new URL(fixtureUrl);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Smoke accepts only a local fixture server");
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: dataset.environment.viewport,
      locale: dataset.environment.locale,
      timezoneId: dataset.environment.timezoneId,
      reducedMotion: "reduce",
      colorScheme: "light",
      serviceWorkers: "block",
    });
    const errors: string[] = [];
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin === url.origin) return route.continue();
      errors.push(`Unexpected external request: ${route.request().url()}`);
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("response", response => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date(dataset.environment.clock));
    await page.goto(fixtureUrl, { waitUntil: "load" });
    await adapter.prepare(page, "browsing");
    const grid = page.getByRole("grid", { name: "Purchase requests", exact: true });
    const target = grid.getByRole("row").filter({ has: page.getByRole("gridcell", { name: "RQ-1042", exact: true }) });
    const search = page.getByRole("searchbox", { name: "Search requests", exact: true });
    await search.fill("northwind");
    await page.getByRole("gridcell", { name: "RQ-1042", exact: true }).waitFor({ state: "hidden" });
    assert.equal(await grid.getByRole("row").count(), 2);
    assert.equal(await grid.getByRole("gridcell", { name: "RQ-1043", exact: true }).isVisible(), true);
    await search.fill("no matching supplier");
    await page.getByText("No matching requests.", { exact: false }).waitFor();
    assert.equal(await grid.getByRole("row").count(), 1);
    await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    await adapter.assertReady(page, "browsing");
    for (const status of dataset.statusFilters.slice(1)) {
      await page.getByRole("combobox", { name: "Status", exact: true }).selectOption(status);
      const expected = dataset.requests.find(request => request.status === status)!;
      await grid.getByRole("gridcell", { name: expected.id, exact: true }).waitFor();
      assert.equal(await grid.getByRole("row").count(), 2);
    }
    await adapter.prepare(page, "target-actions-available");
    const actions = page.getByRole("toolbar", { name: "Actions for RQ-1042", exact: true });
    await actions.getByRole("button", { name: "View request", exact: true }).click();
    const detail = page.getByRole("dialog", { name: "View request · RQ-1042", exact: true });
    await detail.waitFor();
    assert.deepEqual(await detail.locator("dd").allTextContents(), ["RQ-1042", "Acme Supplies", "$1,200.00", "Overdue", "Morgan Lee"]);
    await detail.getByRole("button", { name: "Close", exact: true }).click();
    await detail.waitFor({ state: "hidden" });
    await adapter.assertReady(page, "target-actions-available");
    await actions.getByRole("button", { name: "Reassign owner", exact: true }).click();
    const reassign = page.getByRole("dialog", { name: "Reassign owner · RQ-1042", exact: true });
    await reassign.getByRole("combobox", { name: "New owner", exact: true }).selectOption("Jamie Chen");
    await reassign.getByRole("button", { name: "Cancel", exact: true }).click();
    await reassign.waitFor({ state: "hidden" });
    await adapter.assertReady(page, "target-actions-available");
    await actions.getByRole("button", { name: "Reassign owner", exact: true }).click();
    assert.equal(await reassign.getByRole("combobox", { name: "New owner", exact: true }).inputValue(), "Morgan Lee");
    await reassign.getByRole("combobox", { name: "New owner", exact: true }).selectOption("Jamie Chen");
    await reassign.getByRole("button", { name: "Save owner", exact: true }).click();
    await reassign.waitFor({ state: "hidden" });
    await target.getByRole("gridcell", { name: "Jamie Chen", exact: true }).waitFor();
    await actions.getByRole("button", { name: "View request", exact: true }).click();
    await detail.waitFor();
    assert.deepEqual(await detail.locator("dd").allTextContents(), ["RQ-1042", "Acme Supplies", "$1,200.00", "Overdue", "Jamie Chen"]);
    await page.keyboard.press("Escape");
    await detail.waitFor({ state: "hidden" });
    assert.equal(await target.getByRole("gridcell", { name: "Morgan Lee", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Reset workspace", exact: true }).click();
    await adapter.assertReady(page, "browsing");
    await adapter.prepare(page, "target-actions-available");
    await actions.getByRole("button", { name: "Reassign owner", exact: true }).click();
    await reassign.getByRole("combobox", { name: "New owner", exact: true }).selectOption("Jamie Chen");
    await page.keyboard.press("Escape");
    await reassign.waitFor({ state: "hidden" });
    await adapter.assertReady(page, "target-actions-available");
    await search.fill("Northwind");
    await actions.waitFor({ state: "hidden" });
    assert.equal(await grid.getByRole("row", { selected: true }).count(), 0, "Filtering clears contextual selection");
    await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    await adapter.assertReady(page, "browsing");
    await page.getByRole("button", { name: "Show overdue requests", exact: true }).click();
    await target.waitFor();
    assert.equal(await grid.getByRole("row").count(), 2);
    assert.equal(await page.getByRole("combobox", { name: "Status", exact: true }).inputValue(), "Overdue");
    await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    await adapter.assertReady(page, "browsing");
    // Selection is mutually exclusive and contextual names follow the actual row.
    await page.getByRole("radio", { name: "Select RQ-1041", exact: true }).check();
    await page.getByRole("toolbar", { name: "Actions for RQ-1041", exact: true }).waitFor();
    await page.getByRole("radio", { name: "Select RQ-1042", exact: true }).check();
    await adapter.assertReady(page, "target-actions-available");
    await actions.getByRole("button", { name: "Clear selection", exact: true }).click();
    await adapter.assertReady(page, "browsing");
    // Reload must also discard saved changes and an open dialog.
    await adapter.prepare(page, "target-actions-available");
    await actions.getByRole("button", { name: "Reassign owner", exact: true }).click();
    await reassign.getByRole("combobox", { name: "New owner", exact: true }).selectOption("Jamie Chen");
    await reassign.getByRole("button", { name: "Save owner", exact: true }).click();
    await reassign.waitFor({ state: "hidden" });
    await actions.getByRole("button", { name: "View request", exact: true }).click();
    await adapter.prepare(page, "browsing");
    assert.deepEqual(errors, [], "No browser runtime errors");
  } finally {
    try { await browser?.close(); }
    finally { await server?.close(); }
  }
});
