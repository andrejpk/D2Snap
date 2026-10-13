import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { records } from "../../cases/records.ts";
import { assessOutput, inspectEvidence } from "../../src/evidence/index.ts";

const state = records.states[1]!;
const view = '<button aria-label="View request"></button>';
const reassign = '<button aria-label="Reassign owner"></button>';
const cue = "**1 request selected**RQ-1042 ";
const group = `<div role="toolbar" aria-label="Request actions" aria-controls="lost-table-id">${view}${reassign}</div>`;
const table = `| Select | Request | | --- | --- | | <input type="checkbox" aria-label="Select RQ-1041"> | RQ-1041 | | <input type="checkbox" aria-label="Select RQ-1042" checked> | RQ-1042 |`;
const output = `<div><div>${cue}${group}</div><div>${table}</div></div>`;
const ariaTable = '<table><tr><td>RQ-1041</td></tr><tr aria-selected="true"><td>RQ-1042</td></tr></table>';
const cases: [string, string, boolean][] = [
  ["retained toolbar and selected row", output, true],
  ["role-free group", output.replace('role="toolbar"', ""), true],
  ["flat action siblings", `<div>${cue}${view}${reassign}${table}</div>`, true],
  ["native strong cue", output.replace(cue, "<strong>1 request selected</strong>RQ-1042 "), true],
  ["record wording", output.replace("1 request selected", "1 record selected"), true],
  ["wrong cue target", output.replace(cue, "**1 request selected**RQ-1041 "), false],
  ["multiple selection cue", output.replace("1 request selected", "2 requests selected"), false],
  ["wrong checked row", output.replace('aria-label="Select RQ-1041"', 'aria-label="Select RQ-1041" checked').replace('aria-label="Select RQ-1042" checked', 'aria-label="Select RQ-1042"'), false],
  ["two checked rows", output.replace('aria-label="Select RQ-1041"', 'aria-label="Select RQ-1041" checked'), false],
  ["no checked row", output.replace(" checked", ""), false],
  ["checkbox type and checked state removed", output.replaceAll('type="checkbox"', "").replace(" checked", ""), false],
  ["checked unrelated checkbox", output.replace('aria-label="Select RQ-1042"', 'aria-label="Approved"'), false],
  ["no cue", output.replace(cue, ""), false],
  ["distant cue", output.replace(cue, `${cue}<p>Unrelated content</p>`), false],
  ["hidden cue", output.replace(cue, `<span hidden>${cue}</span>`), false],
  ["code-literal cue", output.replace(cue, `<code>${cue}</code>`), false],
  ["disabled view", output.replace(view, view.replace("<button ", "<button disabled ")), false],
  ["disabled group", output.replace('role="toolbar"', 'role="toolbar" aria-disabled="true"'), false],
  ["hidden group", output.replace('role="toolbar"', 'role="toolbar" hidden'), false],
  ["duplicate view buttons in group", output.replace(view, view + view), false],
  ["two matching contextual groups", output.replace(cue + group, cue + group + cue + group), false],
  ["conflicting group target name", output.replace('aria-label="Request actions"', 'aria-label="Actions for RQ-1041"'), false],
  ["broken explicit group name", output.replace('role="toolbar"', 'role="toolbar" aria-labelledby="missing"'), false],
  ["ID points to something else", output + '<div id="lost-table-id"></div>', false],
  ["unrelated view button cannot be borrowed", output.replace(view, "") + view, false],
  ["unrelated duplicate does not invalidate bounded group", output + view, true],
  ["no selection cue on standalone button", view, false],
  ["explicit selected row without ID", `<div>${cue}${group}${ariaTable}</div>`, true],
  ["contradictory checkbox state", output.replace('aria-label="Select RQ-1042" checked', 'aria-label="Select RQ-1042" checked aria-checked="false"'), false],
  ["contradictory selected row and unchecked box", `<div>${cue}${group}${ariaTable.replace("<td>RQ-1042</td>", '<td>RQ-1042</td><td><input type="checkbox" aria-label="Select RQ-1042"></td>')}</div>`, false],
  ["conflicting group role", output.replace('role="toolbar"', 'role="listbox"'), false],
];
for (const [name, source, expected] of cases) {
  test(`selected-record context: ${name}`, () => {
    const score = assessOutput(source, state, "no input fallback");
    const goal = score.requirements.find(r => r.id === "view-request")!;
    assert.equal(goal.passed, expected, goal.reasons.join("\n"));
    assert.equal(score.outputBytes, Buffer.byteLength(source));
    if (expected) {
      assert.equal(goal.match, "inferred");
      assert.equal(goal.semanticPassed, false);
      assert.ok(goal.inferenceRules.includes("selected-record-context"));
    }
  });
}
test("selected-record context inspection identifies the original buttons", () => {
  const score = assessOutput(output, state, "");
  assert.equal(score.requirements.find(r => r.id === "reassign-owner")!.passed, true);
  assert.deepEqual(score, assessOutput(output, state, ""));
  const inspection = inspectEvidence(output, state, score);
  const dom = new JSDOM(inspection.html);
  try {
    for (const [id, label] of [["view-request", "View request"], ["reassign-owner", "Reassign owner"]]) {
      const highlight = inspection.highlights[id!]!;
      assert.equal(highlight.kind, "match");
      assert.equal(highlight.selectors.length, 1);
      assert.equal(dom.window.document.querySelector(highlight.selectors[0]!)?.getAttribute("aria-label"), label);
    }
  } finally { dom.window.close(); }
});
