import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import { CacheStore } from "../src/cache/index.ts";
import { benchRoot, fixtureArtifact } from "../src/runner/artifacts.ts";
import { startServer } from "../src/runner/server.ts";
import type { Counts } from "../src/runner/models.ts";

test("the fixture implements selection, details, owner edits, filtering and reset", async () => {
  const counts: Counts = { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 };
  const artifact = await fixtureArtifact(new CacheStore(join(benchRoot, ".cache", "artifacts")), counts, false);
  const server = await startServer(artifact.files);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.url}/fixture/?clawpilotTheme=light`);
    const target = page.getByRole("row").filter({ hasText: "RQ-1042" });
    await target.getByRole("checkbox").check();
    assert.equal(await target.getAttribute("aria-selected"), "true");
    await page.getByRole("button", { name: "View request", exact: true }).click();
    assert.match(await page.getByRole("dialog").innerText(), /RQ-1042/);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Reassign owner", exact: true }).click();
    await page.getByLabel("New owner", { exact: true }).selectOption({ label: "Jamie Chen" });
    await page.getByRole("button", { name: "Save owner", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.match(await target.innerText(), /Jamie Chen/);
    await page.reload();
    assert.match(await target.innerText(), /Morgan Lee/);
    await page.getByLabel("Search requests", { exact: true }).fill("RQ-1043");
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1);
    assert.match(await page.locator("tbody").innerText(), /RQ-1043/);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByLabel("Status", { exact: true }).selectOption({ label: "Overdue" });
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1);
    assert.match(await page.locator("tbody").innerText(), /RQ-1042/);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 3);
    assert.deepEqual(errors, []);
  } finally {
    try { await browser?.close(); }
    finally { await server.close(); }
  }
});
