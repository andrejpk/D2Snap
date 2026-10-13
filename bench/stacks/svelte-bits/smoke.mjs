import assert from "node:assert/strict";
import { chromium } from "playwright";
import { dataset } from "@perception-bench/scenarios";
import adapter from "./adapters/records.ts";
import { fixtureFiles } from "./fixture-files.mjs";
import { startServer } from "../../src/runner/server.ts";

const server = process.env.FIXTURE_URL ? undefined : await startServer(await fixtureFiles());
const url = new URL(process.env.FIXTURE_URL ?? `${server.url}/fixture/?clawpilotTheme=light`);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Use a local fixture server");
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: dataset.environment.viewport,
    locale: dataset.environment.locale,
    timezoneId: dataset.environment.timezoneId,
    reducedMotion: dataset.environment.reducedMotion,
    colorScheme: "light",
  });
  await context.route("**/*", route => new URL(route.request().url()).origin === url.origin
    ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.setFixedTime(new Date(dataset.environment.clock));
  await page.goto(url.href);
  await adapter.prepare(page, "browsing");
  const card = id => page.getByRole("region", { name: `Request ${id}`, exact: true });
  const owner = id => card(id).locator("dl").filter({ has: page.locator("dt", { hasText: /^Owner$/ }) }).locator("dd");
  const search = page.getByRole("searchbox", { name: "Search requests", exact: true });
  const filter = page.getByRole("combobox", { name: "Status", exact: true });
  const cards = page.getByRole("region", { name: /^Request RQ-/ });

  await search.fill("northwind");
  await card("RQ-1042").waitFor({ state: "hidden" });
  assert.equal(await cards.count(), 1);
  assert.equal(await card("RQ-1043").isVisible(), true);
  await filter.selectOption("Overdue");
  await page.getByRole("heading", { name: "No matching requests" }).waitFor();
  assert.equal(await cards.count(), 0);
  await search.fill("");
  await card("RQ-1042").waitFor();
  assert.equal(await cards.count(), 1);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await card("RQ-1043").waitFor();
  await adapter.assertReady(page, "browsing");

  await adapter.prepare(page, "target-actions-available");
  await card("RQ-1042").getByRole("menuitem", { name: "View request", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Request RQ-1042", exact: true });
  await dialog.waitFor();
  assert.deepEqual(await dialog.locator("dd").allTextContents(), ["Acme Supplies", "$1,200.00", "Overdue", "Morgan Lee"]);
  await dialog.getByRole("button", { name: "Close details", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });

  async function reassign(id) {
    await card(id).getByRole("button", { name: `Actions for ${id}`, exact: true }).click();
    await card(id).getByRole("menuitem", { name: "Reassign owner", exact: true }).click();
    const edit = page.getByRole("dialog", { name: `Reassign owner for ${id}`, exact: true });
    await edit.waitFor();
    return edit;
  }

  dialog = await reassign("RQ-1042");
  assert.equal(await dialog.getByLabel("New owner", { exact: true }).inputValue(), "Morgan Lee");
  await dialog.getByLabel("New owner", { exact: true }).selectOption("Jamie Chen");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await owner("RQ-1042").textContent(), "Morgan Lee");

  dialog = await reassign("RQ-1042");
  assert.equal(await dialog.getByLabel("New owner", { exact: true }).inputValue(), "Morgan Lee");
  await dialog.getByLabel("New owner", { exact: true }).selectOption("Jamie Chen");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await owner("RQ-1042").textContent(), "Morgan Lee");

  dialog = await reassign("RQ-1042");
  await dialog.getByLabel("New owner", { exact: true }).selectOption("Jamie Chen");
  await dialog.getByRole("button", { name: "Save owner", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await owner("RQ-1042").textContent(), "Jamie Chen");
  await page.getByRole("button", { name: "Reset workspace", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Workspace reset" }).waitFor();
  await adapter.assertReady(page, "browsing");

  dialog = await reassign("RQ-1041");
  await dialog.getByLabel("New owner", { exact: true }).selectOption("Morgan Lee");
  await dialog.getByRole("button", { name: "Save owner", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await owner("RQ-1041").textContent(), "Morgan Lee");
  assert.equal(await owner("RQ-1042").textContent(), "Morgan Lee");
  assert.equal(await owner("RQ-1043").textContent(), "Jamie Chen");
  await adapter.prepare(page, "browsing");

  const trigger = card("RQ-1042").getByRole("button", { name: "Actions for RQ-1042", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await card("RQ-1042").getByRole("menu").waitFor();
  await adapter.assertReady(page, "target-actions-available");
  await page.keyboard.press("Escape");
  await card("RQ-1042").getByRole("menu").waitFor({ state: "hidden" });
  await adapter.assertReady(page, "browsing");
  assert.deepEqual(errors, [], "Client must not produce uncaught errors");
  console.log("PASS: adapter states, search/status/reset, details, owner save/cancel/Escape, record association, keyboard menu, reload.");
} finally {
  try { await browser?.close(); }
  finally { await server?.close(); }
}
