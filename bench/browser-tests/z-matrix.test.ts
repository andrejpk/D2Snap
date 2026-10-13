import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium } from "playwright";
import { benchRoot, reportRoot, subjectArtifact } from "../src/runner/artifacts.ts";
import { CacheStore } from "../src/cache/index.ts";
import { BrowserSession } from "../src/runner/browser.ts";
import { runSuite } from "../src/runner/suite.ts";
import { cellId } from "../src/runner/cell-id.ts";
import type { Counts, SuiteReport } from "../src/runner/models.ts";

function measurements(suite: SuiteReport) {
  return suite.reports.map(report => ({
    cell: cellId(report), captures: report.captures, fixtureHash: report.fixtureHash, subject: report.subject,
    results: report.results.map(result => ({
      state: result.stateId, profile: result.profileId, output: result.output, assessment: result.assessment,
      captureKey: result.captureKey, transformKey: result.transformKey, assessmentKey: result.assessmentKey,
    })),
  }));
}

test("five native records cells retain raw goals, cache all levels, and share an offline inspector", { timeout: 600_000 }, async () => {
  const suite = await runSuite();
  assert.equal(suite.reports.length, 5);
  for (const report of suite.reports) {
    assert.equal(report.results.length, 22);
    for (const state of report.caseDefinition.states) {
      const results = report.results.filter(result => result.stateId === state.id);
      assert.equal(results.length, 11);
      assert.equal(results.find(result => result.profileId === "raw")!.assessment.retention.overall.numerator, state.requirements.length);
      for (const result of results) {
        assert.equal(result.assessment.outputBytes, Buffer.byteLength(result.output));
        if (result.configuration) assert.deepEqual(
          [result.configuration.rE, result.configuration.rA, result.configuration.rT],
          Array(3).fill(Number(result.profileId)));
      }
    }
  }
  const warm = await runSuite({ assertCached: true });
  assert.deepEqual(measurements(warm), measurements(suite));
  assert.ok(warm.reports.every(report => Object.values(report.counts).every(value => value === 0)));
  const replayCounts: Counts = { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 };
  const subject = await subjectArtifact(new CacheStore(join(benchRoot, ".cache", "artifacts")), replayCounts, false);
  const replay = new BrowserSession({}, replayCounts);
  try {
    for (const report of suite.reports) {
      for (const result of report.results.filter(result => result.profileId === "0.3")) {
        assert.ok(result.configuration);
        const fresh = await replay.transform(report.captures[result.stateId]!.html, subject.code, result.configuration);
        assert.equal(fresh, result.output, `${cellId(report)}/${result.stateId} fresh replay differs from cached output`);
      }
    }
  } finally { await replay.close(); }
  await mkdir(join(benchRoot, ".cache", "matrix-tests"), { recursive: true });
  const scratch = await mkdtemp(join(benchRoot, ".cache", "matrix-tests", "offline-"));
  const path = join(scratch, "matrix.html");
  await copyFile(join(reportRoot, "index.html"), path);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true, acceptDownloads: true });
    const requests: string[] = [], errors: string[] = [];
    context.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
    const page = await context.newPage();
    await page.goto(pathToFileURL(path).href);
    await page.getByRole("button", { name: "By stack", exact: true }).click();
    await page.getByRole("table", { name: "Results by stack", exact: true }).getByRole("button", { name: "React Shadcn", exact: true }).click();
    assert.equal(await page.getByLabel("Framework stack").locator("option").count(), 5);
    for (const report of suite.reports) {
      await page.getByLabel("Framework stack").selectOption(cellId(report));
      assert.deepEqual(await page.locator(".bench-results-table").first().locator("tbody .bench-text-button").allTextContents(),
        ["Raw", "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1.0"]);
      assert.equal(await page.locator(".bench-size-bar").count(), 22);
      assert.equal(await page.getByText("All goals counts explicit", { exact: false }).count(), 0);
      for (const state of report.caseDefinition.states) {
        const rows = report.results.filter(result => result.stateId === state.id);
        const maximum = Math.max(...rows.map(result => result.assessment.outputBytes));
        for (const result of rows) {
          const bar = page.locator(`[data-result-id="${state.id}-${result.profileId}"] .bench-size-bar`);
          const width = await bar.evaluate(element => parseFloat((element as HTMLElement).style.width));
          assert.ok(Math.abs(width - result.assessment.outputBytes / maximum * 100) < 0.001);
        }
      }
      await page.locator('[data-result-id="target-actions-available-raw"] .bench-inspect-button').click();
      await page.locator('[data-goal-id="view-request"]').click();
      const raw = page.frameLocator('iframe[title="Raw rendered preview"]');
      await raw.locator('[data-bench-highlight="match"]').first().waitFor();
      assert.equal(await raw.locator('[data-bench-highlight="match"]').first().evaluate(element => getComputedStyle(element).outlineStyle), "solid");
      assert.ok(await raw.locator('[data-bench-highlight="match"]').first().evaluate(element => {
        const box = element.getBoundingClientRect();
        const window = element.ownerDocument.defaultView!;
        return box.right > 0 && box.left < window.innerWidth && box.bottom > 0 && box.top < window.innerHeight;
      }), `${report.stackId} highlighted action must be visible inside the rendered pane`);
      const pane = page.locator(".bench-pane").first();
      await pane.getByRole("button", { name: "Source", exact: true }).click();
      await pane.locator('[data-bench-source-highlight="match"]').first().waitFor({ timeout: 60_000 });
      assert.equal(await pane.locator('[data-bench-source-highlight="match"]').first().evaluate(element => getComputedStyle(element).outlineStyle), "none");
      const [download] = await Promise.all([
        page.waitForEvent("download"), pane.getByRole("button", { name: "Download", exact: true }).click(),
      ]);
      assert.equal(await readFile((await download.path())!, "utf8"), report.captures["target-actions-available"]!.html);
      await page.getByRole("button", { name: "Close inspector" }).click();
    }
    const [download] = await Promise.all([
      page.waitForEvent("download"), page.getByRole("button", { name: "Download standalone HTML" }).click(),
    ]);
    const copy = join(scratch, "downloaded.html");
    await download.saveAs(copy);
    const second = await context.newPage();
    await second.goto(pathToFileURL(copy).href);
    await second.getByRole("button", { name: "By stack", exact: true }).click();
    await second.getByRole("table", { name: "Results by stack", exact: true }).getByRole("button", { name: "React Shadcn", exact: true }).click();
    await second.getByLabel("Framework stack").selectOption(cellId(suite.reports.at(-1)!));
    assert.equal(await second.locator(".bench-results-table tbody tr").count(), 22);
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
    await rm(scratch, { recursive: true, force: true });
  }
});
