import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium } from "playwright";
import { benchRoot, reportRoot } from "../src/runner/artifacts.ts";
import { runDemo } from "../src/runner/run.ts";
import { renderReport } from "../src/runner/report.ts";
import { assessOutput } from "../src/evidence/index.ts";

test("the standalone report works offline with inspection, truthful highlights, configs and downloads", { timeout: 120_000 }, async () => {
  const report = await runDemo();
  await mkdir(join(benchRoot, ".cache", "report-tests"), { recursive: true });
  const scratch = await mkdtemp(join(benchRoot, ".cache", "report-tests", "offline-"));
  const path = join(scratch, "standalone.html");
  await copyFile(join(reportRoot, "index.html"), path);
  assert.deepEqual(await readdir(scratch), ["standalone.html"]);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: "light", offline: true, acceptDownloads: true });
    const requests: string[] = [];
    const errors: string[] = [];
    context.on("request", request => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
    const page = await context.newPage();
    await page.goto(pathToFileURL(path).href);
    await page.locator(".bench-results-table").first().waitFor();
    assert.equal(await page.getByRole("heading", { name: "What survives compression?" }).count(), 0);
    assert.equal(await page.locator("#bench-viewer .cards").count(), 0);
    assert.equal(await page.locator(".bench-results-table").count(), 2);
    assert.deepEqual(await page.locator(".bench-results-table").first().locator("tbody .bench-text-button").allTextContents(),
      ["Raw", "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1.0"]);
    for (const state of report.caseDefinition.states) {
      const rows = report.results.filter(result => result.stateId === state.id);
      const maximum = Math.max(...rows.map(result => result.assessment.outputBytes));
      assert.equal(rows.length, 11);
      for (const result of rows) {
        const cell = page.locator(`[data-result-id="${state.id}-${result.profileId}"] .bench-size-cell`);
        assert.equal(await cell.locator(".bench-size-value").innerText(), result.assessment.outputKB.toFixed(3));
        const width = await cell.locator(".bench-size-bar").evaluate(element => (element as HTMLElement).style.width);
        assert.ok(Math.abs(parseFloat(width) - (maximum ? result.assessment.outputBytes / maximum * 100 : 0)) < 0.001);
        assert.match((await cell.getAttribute("aria-label"))!, /largest output.*including Raw/);
      }
    }
    assert.ok((await page.locator(".bench-results-table th").allTextContents()).every(text => !/cache/i.test(text)));
    assert.equal(await page.getByRole("link", { name: "Open interactive fixture" }).count(), 0);
    await page.screenshot({ path: join(reportRoot, "interactive-overview.png"), fullPage: true });

    const trigger = page.locator('[data-result-id="target-actions-available-raw"] .bench-inspect-button');
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Compare representations" });
    await dialog.waitFor();
    assert.equal(await dialog.locator(".bench-pane-note, .bench-inspector-legend").count(), 0);
    await dialog.locator('[data-goal-id="view-request"]').click();
    const raw = page.frameLocator('iframe[title="Raw rendered preview"]');
    const output = page.frameLocator('iframe[title="Output rendered preview"]');
    await raw.locator('[data-bench-highlight="match"]').first().waitFor();
    await output.locator('[data-bench-highlight="match"]').first().waitFor();
    await dialog.locator(".bench-connector:not([hidden])").waitFor();
    const firstArrow = await dialog.locator(".bench-connector > path").getAttribute("d");
    assert.ok(firstArrow?.startsWith("M "));
    await page.setViewportSize({ width: 1200, height: 860 });
    await page.waitForFunction(previous => document.querySelector(".bench-connector > path")?.getAttribute("d") !== previous, firstArrow);

    await page.getByLabel("Comparison result").selectOption("target-actions-available-0.1");
    await dialog.locator('[data-goal-id="view-request"]').click();
    await raw.locator('[data-bench-highlight="match"]').first().waitFor();
    const measured = report.results.find(result => result.stateId === "target-actions-available" && result.profileId === "0.1")!;
    const retained = measured.assessment.requirements.find(goal => goal.id === "view-request")!.passed;
    assert.match(await dialog.locator('[data-goal-id="view-request"]').innerText(), retained ? /retained/i : /missing/i);
    await output.locator("[data-bench-view-node]").first().waitFor({ state: "attached" });
    if (retained) await output.locator('[data-bench-highlight="match"]').first().waitFor();
    else assert.equal(await output.locator('[data-bench-highlight="match"]').count(), 0);
    for (const id of ["request-facts", "status-filter", "view-request", "reassign-owner"]) {
      await dialog.locator(`[data-goal-id="${id}"]`).click();
      const goal = measured.assessment.requirements.find(item => item.id === id)!;
      assert.equal(await dialog.locator(`[data-goal-id="${id}"]`).getAttribute("data-match"), goal.match);
      if (goal.passed) {
        await output.locator('[data-bench-highlight="match"]').first().waitFor();
        assert.match(await dialog.locator(".bench-goal-details").innerText(),
          goal.semanticPassed ? /Explicit semantic evidence/ : /deterministic inference/);
      } else assert.equal(await output.locator('[data-bench-highlight="match"]').count(), 0);
    }
    await dialog.locator('[data-goal-id="view-request"]').click();
    await page.screenshot({ path: join(reportRoot, "interactive-inspector.png") });
    const outputPane = dialog.locator(".bench-pane").nth(1);
    await outputPane.getByRole("button", { name: "Source", exact: true }).click();
    const expected = measured.output;
    await outputPane.getByRole("textbox", { name: "Formatted output source" }).waitFor();
    await outputPane.locator('[data-bench-source-highlight="match"][data-provenance="inferred"]').first().waitFor();
    assert.equal(await outputPane.locator(".cm-content").getAttribute("contenteditable"), "false");
    assert.equal(await dialog.locator(".bench-source-outline, .bench-source-tools").count(), 0);
    await outputPane.locator('[title="Fold line"]:visible').first().click();
    await outputPane.locator(".cm-foldPlaceholder").first().waitFor();
    await outputPane.locator('[title="Unfold line"]:visible').first().click();
    assert.equal(await outputPane.locator(".cm-foldPlaceholder").count(), 0);
    const rawPane = dialog.locator(".bench-pane").first();
    await rawPane.getByRole("button", { name: "Source", exact: true }).click();
    await rawPane.getByRole("textbox", { name: "Formatted raw source" }).waitFor();
    await rawPane.locator('[data-bench-source-highlight="match"][data-provenance="explicit"]').first().waitFor();
    const bands = await rawPane.locator('.cm-content > .cm-line[data-bench-source-highlight="match"]').evaluateAll(elements =>
      elements.map(element => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { top: box.top, bottom: box.bottom, background: style.backgroundColor, outline: style.outlineStyle, shadow: style.boxShadow };
      }));
    assert.ok(bands.length > 1, "Multiline source uses complete line backgrounds");
    for (const [index, band] of bands.entries()) {
      assert.equal(band.outline, "none");
      assert.equal(band.shadow, "none");
      if (index) {
        assert.ok(Math.abs(band.top - bands[index - 1]!.bottom) < 0.5, "Adjacent highlight lines have no gap");
        assert.equal(band.background, bands[index - 1]!.background);
      }
    }
    await rawPane.locator('[title="Fold line"]:visible').first().click();
    await rawPane.locator(".cm-foldPlaceholder").first().waitFor();
    await rawPane.locator('[title="Unfold line"]:visible').first().click();
    await page.screenshot({ path: join(reportRoot, "interactive-source.png") });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      outputPane.getByRole("button", { name: "Download", exact: true }).click(),
    ]);
    assert.equal(await readFile((await download.path())!, "utf8"), expected);
    await outputPane.getByRole("textbox", { name: "Formatted output source" }).focus();
    await page.keyboard.press("Control+Alt+[");
    await outputPane.locator(".cm-foldPlaceholder").first().waitFor();
    await dialog.locator('[data-goal-id="status-filter"]').click();
    await outputPane.locator('[data-bench-source-highlight="match"]').filter({ hasText: "select" }).first().waitFor();

    await page.getByLabel("Comparison result").selectOption("target-actions-available-0.6");
    await dialog.locator('[data-goal-id="view-request"]').click();
    await output.locator('[data-bench-highlight="context"]').first().waitFor();
    assert.equal(await output.locator('[data-bench-highlight="context"]').first().evaluate(element => getComputedStyle(element).outlineStyle), "dashed");
    await outputPane.getByRole("button", { name: "Source", exact: true }).click();
    await outputPane.locator('[data-bench-source-highlight="context"][data-provenance="none"]').first().waitFor();
    assert.equal(await outputPane.locator('[data-bench-source-highlight="context"]').first().evaluate(element => getComputedStyle(element).outlineStyle), "none");
    assert.equal(await outputPane.locator('[data-bench-source-highlight="match"]').count(), 0);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);

    await page.getByRole("button", { name: "Configurations", exact: true }).click();
    assert.deepEqual(await page.locator(".bench-profile-list button").allTextContents(),
      ["Raw", "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1.0"]);
    await page.locator('[data-profile-id="0.6"]').click();
    await page.getByLabel("Filter attribute scores").fill("role");
    assert.match(await page.getByRole("table", { name: "Attribute scores", exact: true }).innerText(), /Removed by attribute pass/);
    await page.locator('[data-profile-id="raw"]').click();
    assert.match(await page.locator(".bench-config-detail").innerText(), /no reduction configuration/i);
    await page.getByRole("button", { name: "Results", exact: true }).click();

    const [artifact] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download standalone HTML" }).click(),
    ]);
    const exported = join(scratch, "exported.html");
    await artifact.saveAs(exported);
    const second = await context.newPage();
    await second.goto(pathToFileURL(exported).href);
    await second.locator(".bench-results-table").first().waitFor();
    assert.equal(await second.locator(".bench-results-table").count(), 2);
    await second.locator('[data-result-id="browsing-raw"] .bench-inspect-button').click();
    const exportedRawPane = second.locator(".bench-pane").first();
    await exportedRawPane.getByRole("button", { name: "Source", exact: true }).click();
    await exportedRawPane.getByRole("textbox", { name: "Formatted raw source" }).waitFor();
    await exportedRawPane.locator('[data-bench-source-highlight="match"]').first().waitFor();
    await exportedRawPane.locator('[title="Fold line"]:visible').first().click();
    await exportedRawPane.locator(".cm-foldPlaceholder").first().waitFor();
    const absentReport = structuredClone(report);
    const absentResult = absentReport.results.find(result => result.stateId === "target-actions-available" && result.profileId === "0.1")!;
    const absentState = absentReport.caseDefinition.states.find(state => state.id === absentResult.stateId)!;
    absentResult.output = "<p>No actions available.</p>";
    absentResult.assessment = assessOutput(absentResult.output, absentState, absentReport.captures[absentState.id]!.html, "html");
    const absentPath = join(scratch, "absent.html");
    await writeFile(absentPath, renderReport(absentReport));
    const absentPage = await context.newPage();
    await absentPage.goto(pathToFileURL(absentPath).href);
    await absentPage.locator('[data-result-id="target-actions-available-0.1"] .bench-inspect-button').click();
    await absentPage.locator('[data-goal-id="view-request"]').click();
    const absentPane = absentPage.locator(".bench-pane").nth(1);
    await absentPane.locator(".bench-location-state").waitFor();
    assert.match(await absentPane.locator(".bench-location-state").innerText(), /Missing/);
    assert.equal(await absentPage.frameLocator('iframe[title="Output rendered preview"]').locator("[data-bench-highlight]").count(), 0);
    await absentPane.getByRole("button", { name: "Source", exact: true }).click();
    await absentPane.getByRole("textbox", { name: "Formatted output source" }).waitFor();
    await absentPane.locator(".bench-source-status").waitFor();
    assert.match(await absentPane.locator(".bench-source-status").innerText(), /Missing/);
    assert.equal(await absentPane.locator("[data-bench-source-highlight]").count(), 0);
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
    await rm(scratch, { recursive: true, force: true });
  }
});
