import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { formatHTMLSource } from "../../src/runner/source-format.ts";

test("source formatting indents HTML while preserving preformatted text and script content as text", async () => {
  const input = '<main><section><h1>Requests</h1><pre> a\n  b </pre><script>window.bad = true;</script></section></main>';
  const formatted = await formatHTMLSource(input);
  assert.match(formatted, /<main>\n  <section>\n    <h1>Requests<\/h1>/);
  const before = new JSDOM(input);
  const after = new JSDOM(formatted);
  assert.equal(after.window.document.querySelector("pre")!.textContent, before.window.document.querySelector("pre")!.textContent);
  before.window.close();
  after.window.close();
  assert.ok(formatted.includes("window.bad = true;"));
  assert.notEqual(formatted, input);
});

test("invalid HTML is reported rather than silently repaired by the formatter", async () => {
  await assert.rejects(formatHTMLSource("<section><div></section>"), /closing tag/i);
});
