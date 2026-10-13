import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium } from "playwright";
import { benchRoot, reportRoot } from "../src/runner/artifacts.ts";
import { suiteReportSchema } from "../src/runner/models.ts";

test("dashboard toggles correct aggregates and drills into the existing summary offline", { timeout: 120_000 }, async () => {
  const suite = suiteReportSchema.parse(JSON.parse(await readFile(join(reportRoot, "suite.json"), "utf8")));
  await mkdir(join(benchRoot, ".cache", "dashboard-tests"), { recursive: true });
  const scratch = await mkdtemp(join(benchRoot, ".cache", "dashboard-tests", "offline-"));
  const path = join(scratch, "dashboard.html");
  await copyFile(join(reportRoot, "index.html"), path);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true, acceptDownloads: true });
    const requests: string[] = [], errors: string[] = [];
    context.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
    const page = await context.newPage();
    await page.goto(pathToFileURL(path).href);
    const configs = page.getByRole("table", { name: "Results by configuration", exact: true });
    await configs.waitFor();
    assert.equal(await configs.locator("tbody tr").count(), 11);
    assert.deepEqual(await configs.locator("tbody .bench-text-button").allTextContents(),
      ["Raw", "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1.0"]);
    for (const row of await configs.locator("tbody tr").all()) {
      const profile = (await row.locator(".bench-text-button").innerText()).toLowerCase();
      const results = suite.reports.flatMap(report => report.results.filter(result => result.profileId === profile));
      const meanRetention = results.reduce((sum, result) => sum + result.assessment.retention.overall.fraction!, 0) / results.length;
      const meanKB = results.reduce((sum, result) => sum + result.assessment.outputBytes, 0) / results.length / 1000;
      assert.equal(await row.locator("td").nth(1).innerText(), String(results.length));
      assert.equal(await row.locator("td").nth(2).innerText(), `${(meanRetention * 100).toFixed(1)}%`);
      assert.equal(await row.locator(".bench-size-value").innerText(), meanKB.toFixed(3));
    }
    await page.screenshot({ path: join(reportRoot, "dashboard-by-configuration.png"), fullPage: true });
    await configs.getByRole("button", { name: "0.3", exact: true }).click();
    const drill = page.getByRole("table", { name: "Selected aggregate by implementation", exact: true });
    assert.equal(await drill.locator("tbody tr").count(), 5);
    await drill.getByRole("button", { name: "Angular Material Ag Grid", exact: true }).click();
    assert.equal(await page.getByLabel("Framework stack").inputValue(), "angular-material-ag-grid.records.selection-toolbar");
    assert.equal(await page.locator(".bench-results-table tbody tr").count(), 22);
    assert.equal(await page.locator('.bench-focused-result[data-result-id$="-0.3"]').count(), 2);
    await page.locator('[data-result-id="browsing-0.3"] .bench-inspect-button').click();
    await page.getByRole("dialog", { name: "Compare representations" }).waitFor();
    await page.getByRole("button", { name: "Close inspector" }).click();
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await drill.waitFor();
    await page.getByRole("button", { name: "By stack", exact: true }).click();
    const stacks = page.getByRole("table", { name: "Results by stack", exact: true });
    assert.equal(await stacks.locator("tbody tr").count(), 5);
    for (const row of await stacks.locator("tbody tr").all()) assert.equal(await row.locator("td").nth(1).innerText(), "20");
    await page.screenshot({ path: join(reportRoot, "dashboard-by-stack.png"), fullPage: true });
    await stacks.getByRole("button", { name: "React Fluent", exact: true }).click();
    assert.equal(await page.getByLabel("Framework stack").inputValue(), "react-fluent.records.selection-toolbar");
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    assert.equal(await page.getByRole("button", { name: "By stack" }).getAttribute("aria-pressed"), "true");
    const [download] = await Promise.all([
      page.waitForEvent("download"), page.getByRole("button", { name: "Download standalone HTML" }).click(),
    ]);
    const exported = join(scratch, "exported.html");
    await download.saveAs(exported);
    const second = await context.newPage();
    await second.goto(pathToFileURL(exported).href);
    await second.getByRole("table", { name: "Results by configuration", exact: true }).waitFor();
    await second.setViewportSize({ width: 700, height: 900 });
    assert.ok(await second.getByRole("button", { name: "By stack", exact: true }).isVisible());
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
    await rm(scratch, { recursive: true, force: true });
  }
});
