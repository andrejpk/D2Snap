import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { records } from "../../cases/records.ts";
import { assessOutput } from "../../src/evidence/index.ts";
import { suiteReportSchema } from "../../src/runner/models.ts";
import type { DemoReport, SuiteReport } from "../../src/runner/models.ts";
import { renderSuite } from "../../src/runner/report.ts";
import { cellId } from "../../src/runner/cell-id.ts";

function cell(stackId: string): DemoReport {
  const output = `<p>${stackId}</p>`;
  return {
    schemaVersion: 1, caseDefinition: records, generatedAt: "2026-06-15T12:00:00Z",
    caseId: "records", stackId, variantId: "selection-toolbar",
    subject: { label: "Test", hash: "a".repeat(64) }, fixtureHash: "b".repeat(64), browser: {},
    counts: { fixtureBuilds: 0, subjectBuilds: 0, captures: 0, transforms: 0, assessments: 0, browserLaunches: 0 },
    captures: { browsing: { html: output, screenshot: "" } },
    results: [{
      stateId: "browsing", profileId: "raw", configuration: null, output,
      assessment: assessOutput(output, records.states[0]!, output, "html"),
      captureKey: "c".repeat(64), transformKey: null, assessmentKey: "d".repeat(64),
      cache: { capture: "hit", transform: "baseline", assessment: "hit" },
    }],
  };
}

test("matrix report keeps distinct cells, source artifacts and standalone payloads", () => {
  const reports = [cell("first-stack"), cell("second-stack")];
  const suite: SuiteReport = { schemaVersion: 1, kind: "matrix", generatedAt: reports[0]!.generatedAt, reports };
  assert.deepEqual(suiteReportSchema.parse(suite), suite);
  assert.throws(() => suiteReportSchema.parse({ ...suite, reports: [reports[0], reports[0]] }));
  assert.throws(() => renderSuite(suite, {}), /Missing fixture assets/);
  const html = renderSuite(suite, Object.fromEntries(reports.map(report => [cellId(report), {}])));
  const dom = new JSDOM(html);
  try {
    const data = JSON.parse(dom.window.document.getElementById("bench-data")!.textContent!);
    assert.equal(data.kind, "matrix");
    assert.equal(data.cells.length, 2);
    assert.deepEqual(data.cells.map((item: { report: DemoReport }) => item.report.stackId), ["first-stack", "second-stack"]);
    assert.equal(dom.window.document.querySelectorAll("#bench-viewer tbody tr").length, 2);
    assert.equal(dom.window.document.querySelectorAll("script[src],link[rel=stylesheet]").length, 0);
  } finally { dom.window.close(); }
});
