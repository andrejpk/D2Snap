import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { CacheStore } from "../src/cache/index.ts";
import { benchRoot, subjectArtifact } from "../src/runner/artifacts.ts";
import { BrowserSession } from "../src/runner/browser.ts";
import { planSchema } from "../src/runner/models.ts";
import type { Counts } from "../src/runner/models.ts";

test("capture mirrors live values/visibility and replay is inert and repeatable", async () => {
  const scratchParent = join(benchRoot, ".cache", "browser-tests");
  await mkdir(scratchParent, { recursive: true });
  const scratch = await mkdtemp(join(scratchParent, "replay-"));
  const counts: Counts = { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 };
  const fixture = `<html><head><style>.concealed{display:none}</style></head><body>
<label>Query<input value="initial"></label><label>Agree<input type="checkbox"></label>
<label>Choice<select><option>One</option><option>Two</option></select></label>
<label>Notes<textarea>Initial</textarea></label><div class="concealed">Hidden content</div></body></html>`;
  const browser = new BrowserSession({ "index.html": Buffer.from(fixture).toString("base64") }, counts);
  try {
    const capture = await browser.capture("probe", {
      caseId: "probe", stackId: "native", variantId: "native",
      async prepare(page) {
        await page.getByLabel("Query").fill("live value");
        await page.getByLabel("Agree").check();
        await page.getByLabel("Choice").selectOption({ label: "Two" });
        await page.getByLabel("Notes").fill("Live notes");
      },
      async assertReady(page) {
        assert.equal(await page.getByLabel("Query").inputValue(), "live value");
      },
    });
    const dom = new JSDOM(capture.html);
    try {
      assert.equal(dom.window.document.querySelector("input")?.getAttribute("value"), "live value");
      assert.equal(dom.window.document.querySelector('input[type="checkbox"]')?.hasAttribute("checked"), true);
      assert.equal(dom.window.document.querySelector("option[selected]")?.textContent, "Two");
      assert.equal(dom.window.document.querySelector("textarea")?.textContent, "Live notes");
      assert.match(dom.window.document.querySelector(".concealed")?.getAttribute("style") ?? "", /display: none/);
      assert.ok(capture.screenshot.length > 0);
    } finally { dom.window.close(); }
    const subject = await subjectArtifact(new CacheStore(scratch), counts, false);
    const plan = planSchema.parse(JSON.parse(await readFile(join(benchRoot, "configs", "poc.json"), "utf8")));
    const configuration = {
      id: "native-probe", rE: 0, rA: 0, rT: 0,
      options: { ...plan.options, skipMarkdown: true },
    };
    const input = '<body><button>Approve</button><script>document.body.textContent="EXECUTED"</script></body>';
    const first = await browser.transform(input, subject.code, configuration);
    const second = await browser.transform(input, subject.code, configuration);
    assert.equal(first, second);
    assert.match(first, /Approve/);
    assert.ok(!first.includes("EXECUTED"));
    assert.equal(counts.browserLaunches, 1);
  } finally {
    await browser.close();
    await rm(scratch, { recursive: true, force: true });
  }
});
