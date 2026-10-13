import assert from "node:assert/strict";
import { test } from "node:test";
import { records } from "../../cases/records.ts";
import { assessOutput } from "../../src/evidence/index.ts";
import { locateSource } from "../../src/runner/source-locations.ts";
import { formatHTMLSource, formattedOffset } from "../../src/runner/source-format.ts";
import { makePreview } from "../../src/runner/preview.ts";

test("source ranges identify the correct identical-looking native control", async () => {
  const control = '<input aria-label="Search requests" value="">';
  const source = `<div hidden>${control}</div><div>${control}</div>`;
  const state = records.states[0]!;
  const assessment = assessOutput(source, state, source, "html");
  const mapped = locateSource(source, state, assessment).search!;
  assert.equal(mapped.kind, "match");
  assert.equal(mapped.provenance, "explicit");
  assert.deepEqual(mapped.ranges, [{ from: source.lastIndexOf(control), to: source.lastIndexOf(control) + control.length }]);
  const formatted = await formatHTMLSource(source);
  const [range] = mapped.ranges;
  const from = await formattedOffset(source, range!.from, formatted);
  const to = await formattedOffset(source, range!.to, formatted);
  assert.match(formatted.slice(from, to), /<input aria-label="Search requests" value=""\s*\/?>/);
  assert.ok(from > formatted.indexOf("</div>"));
});

test("unmatched context and absent source are distinct and never borrowed from input", () => {
  const state = records.states[1]!;
  const source = '<button aria-label="View request"></button>';
  const assessment = assessOutput(source, state, "", "html");
  const mapped = locateSource(source, state, assessment)["view-request"]!;
  assert.equal(mapped.kind, "context");
  assert.equal(mapped.provenance, "none");
  assert.deepEqual(mapped.ranges, [{ from: 0, to: source.length }]);
  const missing = "<p>No actions available.</p>";
  const absent = locateSource(missing, state, assessOutput(missing, state, source, "html"))["view-request"]!;
  assert.equal(absent.kind, "none");
  assert.deepEqual(absent.ranges, []);
});

test("generated Markdown rows map only to their truthful containing source block", () => {
  const source = '<div>| Request | Supplier | Amount | Status | Owner | | --- | --- | --- | --- | --- | | RQ-1042 | Acme Supplies | $1,200.00 | Overdue | MLMorgan Lee |</div>';
  const state = records.states[0]!;
  const assessment = assessOutput(source, state, source);
  const preview = makePreview(source, state, assessment);
  assert.equal(preview.highlights["request-facts"]!.kind, "match");
  const mapped = preview.sourceHighlights["request-facts"]!;
  assert.equal(mapped.kind, "context");
  assert.equal(mapped.provenance, "inferred");
  assert.match(mapped.explanation, /Containing source block/);
  assert.deepEqual(mapped.ranges, [{ from: 0, to: source.length }]);
  assert.ok(!preview.document.includes("data-bench-source-origin"));
  assert.equal(assessment.outputBytes, Buffer.byteLength(source));
});

test("origin markers do not promote code-literal controls into source matches", () => {
  const source = '```\n<button aria-label="View request"></button>\n```';
  const state = records.states[1]!;
  const mapped = locateSource(source, state, assessOutput(source, state, ""))["view-request"]!;
  assert.equal(mapped.kind, "none");
  assert.deepEqual(mapped.ranges, []);
});

test("source range formatting handles Unicode, CRLF and changed attribute quotes", async () => {
  const source = "<div>\r\n<p>Résumé 👋</p>\r\n<button aria-label='View request'>Open</button></div>";
  const from = source.indexOf("<button");
  const to = source.indexOf("</button>") + "</button>".length;
  const formatted = await formatHTMLSource(source);
  const mappedFrom = await formattedOffset(source, from, formatted);
  const mappedTo = await formattedOffset(source, to, formatted);
  assert.equal(formatted.slice(mappedFrom, mappedTo).trimStart(), '<button aria-label="View request">Open</button>');
});
