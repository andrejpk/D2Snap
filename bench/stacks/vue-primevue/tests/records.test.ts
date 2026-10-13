import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { dataset } from "@perception-bench/scenarios";
import adapter from "../adapters/records.ts";
// Harness-only test imports. None of these modules enter the Vite browser graph.
import { records } from "../../../cases/records.ts";
import { assessOutput } from "../../../src/evidence/index.ts";
import { BrowserSession } from "../../../src/runner/browser.ts";
import type { Counts } from "../../../src/runner/models.ts";
import { startServer } from "../../../src/runner/server.ts";

test("records: raw goals, deterministic preparation, and local interactions", { timeout: 90_000 }, async t => {
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  const files: Record<string, string> = {};
  async function collect(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else files[relative(dist, path).split(sep).join("/")] = (await readFile(path)).toString("base64");
    }
  }
  await collect(dist);
  const counts: Counts = {
    fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0,
    captures: 0, transforms: 0, assessments: 0,
  };
  const session = new BrowserSession(files, counts);
  try {
    for (const state of records.states) {
      const first = await session.capture(state.id, adapter);
      const second = await session.capture(state.id, adapter);
      const assessment = assessOutput(first.html, state, first.html, "html");
      const repeated = assessOutput(second.html, state, second.html, "html");
      assert.equal(assessment.fullFidelity, true, JSON.stringify(assessment.requirements.filter(goal => !goal.passed)));
      const expected = state.id === "browsing" ? 3 : 5;
      assert.equal(assessment.retention.overall.numerator, expected);
      assert.equal(assessment.retention.overall.denominator, expected);
      assert.equal(assessment.semanticRetention.overall.numerator, expected);
      assert.equal(second.html, first.html, `${state.id}: fresh raw outputs must be byte-identical`);
      assert.equal(second.screenshot, first.screenshot, `${state.id}: fresh screenshots must be byte-identical`);
      assert.deepEqual(repeated, assessment, `${state.id}: assessments must be identical`);
      t.diagnostic(`${state.id}: raw and semantic ${expected}/${expected}; fresh HTML, screenshots and assessments identical`);
    }
  } finally { await session.close(); }
  const server = await startServer(files);
  try {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: dataset.environment.viewport, locale: dataset.environment.locale,
        timezoneId: dataset.environment.timezoneId, reducedMotion: "reduce",
        colorScheme: "light", serviceWorkers: "block",
      });
      const errors: string[] = [];
      await context.route("**/*", route => {
        if (new URL(route.request().url()).origin === server.url) return route.continue();
        errors.push(`External request: ${route.request().url()}`);
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      page.on("response", response => {
        if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      await page.clock.setFixedTime(new Date(dataset.environment.clock));
      await page.addInitScript((seed: number) => {
        let value = seed;
        Math.random = () => {
          value = (Math.imul(1664525, value) + 1013904223) >>> 0;
          return value / 4294967296;
        };
      }, dataset.seed);
      await page.goto(`${server.url}/fixture/?clawpilotTheme=light`);
      await adapter.prepare(page, "browsing");
      const table = page.getByRole("table", { name: "Purchase requests", exact: true });
      const search = page.getByRole("searchbox", { name: "Search requests", exact: true });
      const status = page.getByRole("combobox", { name: "Status", exact: true });
      for (const value of dataset.statusFilters) {
        await status.selectOption(value);
        const expected = dataset.requests.filter(record => value === "All statuses" || record.status === value);
        await page.waitForFunction(count => document.querySelectorAll('table tbody > tr').length === count, expected.length);
        assert.deepEqual(await table.locator("tbody > tr > td:first-child").allTextContents(), expected.map(record => record.id));
      }
      await page.getByRole("button", { name: "Reset filters", exact: true }).click();
      await search.fill("northwind");
      await page.getByRole("cell", { name: "RQ-1042", exact: true }).waitFor({ state: "hidden" });
      assert.equal(await table.locator("tbody > tr").count(), 1);
      assert.equal(await table.getByRole("cell", { name: "RQ-1043", exact: true }).isVisible(), true);
      await status.selectOption("Overdue");
      await page.getByText("No requests match these filters.", { exact: false }).waitFor();
      await status.selectOption("Pending");
      await table.getByRole("cell", { name: "RQ-1043", exact: true }).waitFor();
      await search.fill("no matching request");
      await page.getByText("No requests match these filters.", { exact: false }).waitFor();
      await page.getByRole("button", { name: "Reset filters", exact: true }).click();
      await adapter.assertReady(page, "browsing");

      for (const record of dataset.requests) {
        await page.getByRole("button", { name: `Actions for ${record.id}`, exact: true }).click();
        await page.getByRole("menuitem", { name: "View request", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: `Request ${record.id}`, exact: true });
        await dialog.waitFor();
        assert.deepEqual(await dialog.locator("dd").allTextContents(), [record.id, record.supplier, record.amount, record.status, record.owner]);
        await dialog.getByRole("button", { name: "Close", exact: true }).last().click();
        await dialog.waitFor({ state: "hidden" });
      }
      const targetRow = table.getByRole("row").filter({ has: page.getByRole("cell", { name: "RQ-1042", exact: true }) });
      for (const action of ["Cancel", "Escape", "Save owner"]) {
        await targetRow.getByRole("button", { name: "Actions for RQ-1042", exact: true }).click();
        await page.getByRole("menuitem", { name: "Reassign owner", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Reassign owner · RQ-1042", exact: true });
        await dialog.getByRole("combobox", { name: "New owner", exact: true }).selectOption("Jamie Chen");
        if (action === "Escape") await page.keyboard.press("Escape");
        else await dialog.getByRole("button", { name: action, exact: true }).click();
        await dialog.waitFor({ state: "hidden" });
        assert.equal((await targetRow.getByRole("cell").nth(4).innerText()).trim(), action === "Save owner" ? "Jamie Chen" : "Morgan Lee");
      }
      for (const [index, record] of dataset.requests.entries()) {
        const actual = (await table.locator("tbody > tr").nth(index).getByRole("cell").allTextContents()).slice(0, 5).map(text => text.trim());
        assert.deepEqual(actual, [record.id, record.supplier, record.amount, record.status,
          record.id === "RQ-1042" ? "Jamie Chen" : record.owner], "Reassignment changes only its row's owner");
      }
      await targetRow.getByRole("button", { name: "Actions for RQ-1042", exact: true }).click();
      await page.getByRole("menuitem", { name: "View request", exact: true }).click();
      const details = page.getByRole("dialog", { name: "Request RQ-1042", exact: true });
      await details.waitFor();
      assert.deepEqual(await details.locator("dd").allTextContents(), ["RQ-1042", "Acme Supplies", "$1,200.00", "Overdue", "Jamie Chen"]);
      await details.getByRole("button", { name: "Reassign owner", exact: true }).click();
      const reassignment = page.getByRole("dialog", { name: "Reassign owner \u00b7 RQ-1042", exact: true });
      await reassignment.waitFor();
      assert.equal(await details.count(), 0, "Details must close when opening reassignment");
      assert.equal(await reassignment.getByRole("combobox", { name: "New owner", exact: true }).inputValue(), "Jamie Chen");
      await reassignment.getByRole("button", { name: "Cancel", exact: true }).click();
      await reassignment.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Restore workspace", exact: true }).click();
      await adapter.assertReady(page, "browsing");
      // Also check reset from dirty filters and an open dialog, not just initial load.
      await search.fill("RQ-1042");
      await status.selectOption("Overdue");
      await targetRow.getByRole("button", { name: "Actions for RQ-1042", exact: true }).click();
      await page.getByRole("menuitem", { name: "Reassign owner", exact: true }).click();
      await adapter.prepare(page, "target-actions-available");
      await page.keyboard.press("Escape");
      await page.locator('[id="request-actions-RQ-1042"]').waitFor({ state: "hidden" });
      await adapter.assertReady(page, "browsing");
      assert.deepEqual(errors, []);
      t.diagnostic("Interactions: all status choices, combined search/status, empty results, all-row details, cancel/Escape/save, unchanged facts, updated details, dialog handoff, restore and dirty reset passed; no runtime/network errors");
      await context.close();
    } finally { await browser.close(); }
  } finally { await server.close(); }
});
