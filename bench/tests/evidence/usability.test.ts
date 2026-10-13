import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { records } from "../../cases/records.ts";
import { assessOutput, inspectEvidence } from "../../src/evidence/index.ts";

const state = records.states[0]!;
const delimiter = "| --- | --- | --- | --- | --- |";
const canonical = `| Request | Supplier | Amount | Status | Owner |\n${delimiter}\n| RQ-1042 | Acme Supplies | $1,200.00 | Overdue | Morgan Lee |`;
const flat = canonical.replaceAll("\n", " ");
const select = "<select><option selected>All statuses</option><option>Pending</option><option>Overdue</option><option>Approved</option></select>";
const contextual = `<div>Status${select}</div>`;
const rows: [string, string, boolean][] = [
  ["ordinary GFM", canonical, true],
  ["nested GFM", `<div>\n${canonical}\n</div>`, true],
  ["flattened GFM", `<div>${flat}</div>`, true],
  ["surrounding prose", `<div>Requests shown: ${flat} End of list.</div>`, true],
  ["matching initials", canonical.replace("Morgan Lee", "MLMorgan Lee"), true],
  ["spaced initials", canonical.replace("Morgan Lee", "ML Morgan Lee"), true],
  ["wrong initials", canonical.replace("Morgan Lee", "JCMorgan Lee"), false],
  ["wrong ID", flat.replace("RQ-1042", "RQ-1041"), false],
  ["continued ID", flat.replace("RQ-1042", "RQ-1042-2"), false],
  ["wrong amount", flat.replace("$1,200.00", "$2,400.00"), false],
  ["contradictory owner", canonical.replace("Morgan Lee", "MLMorgan Lee / Jamie Chen"), false],
  ["longer owner name", canonical.replace("Morgan Lee", "Morgan Lee Smith"), false],
  ["missing separator", flat.replace(delimiter, ""), false],
  ["duplicate header", flat.replace("| Status |", "| Owner |"), false],
  ["missing cell", flat.replace("| Overdue |", "|"), false],
  ["extra cell", flat.replace("| Overdue |", "| Overdue | extra |"), false],
  ["duplicate target", flat + " | RQ-1042 | Acme Supplies | $1,200.00 | Overdue | Morgan Lee |", false],
  ["wrong header association", flat.replace("| Supplier | Amount |", "| Amount | Supplier |"), false],
  ["hidden table", `<div hidden>${flat}</div>`, false],
  ["code literal", `<pre><code>${flat}</code></pre>`, false],
  ["fenced literal", "```\n" + canonical + "\n```", false],
  ["changed escaped value", canonical.replace("Acme Supplies", "Acme\\|Supplies"), false],
  ...["", "High\\|Medium", '<input type="checkbox">', '<input type="checkbox" aria-label="Select | request">'].map((extra): [string, string, boolean] => [
    `unrelated cell ${extra}`, `| Extra | Request | Supplier | Amount | Status | Owner | | --- | --- | --- | --- | --- | --- | | ${extra} | RQ-1042 | Acme Supplies | $1,200.00 | Overdue | Morgan Lee |`, true,
  ]),
  ["cannot borrow another row", flat.replace("Overdue", "Pending") + " | RQ-1043 | Acme Supplies | $1,200.00 | Overdue | Morgan Lee |", false],
  ["different owner", canonical.replace("Morgan Lee", "JCJamie Chen"), false],
  ["conflicting suffix", canonical.replace("Morgan Lee", "MLMorgan Lee Former Owner"), false],
];
const controls: [string, string, boolean][] = [
  ["plain adjacent label", contextual, true],
  ["passive span label", `<div><span>Status</span>${select}</div>`, true],
  ["different control type", `<div><input aria-label="Search">Status${select}</div>`, true],
  ["explicit label", `<div><label for="filter">Status</label>${select.replace("<select>", '<select id="filter">')}</div>`, true],
  ["wrong selected value", contextual.replace("<option selected>All statuses</option><option>Pending</option>", "<option>All statuses</option><option selected>Pending</option>"), false],
  ["wrong label", contextual.replace("Status", "Supplier"), false],
  ["longer label", contextual.replace("Status", "Status history"), false],
  ["two selects", `<div>Status${select}${select}</div>`, false],
  ["different parent", `<div>Status<div>${select}</div></div>`, false],
  ["intervening prose", `<div>Status<p>Other instructions</p>${select}</div>`, false],
  ["hidden label", `<div><span hidden>Status</span>${select}</div>`, false],
  ["CSS-hidden label", `<div><span style="display:none">Status</span>${select}</div>`, false],
  ["hidden control", contextual.replace("<select>", "<select hidden>"), false],
  ["conflicting explicit name", contextual.replace("<select>", '<select aria-label="Supplier">'), false],
  ["broken name reference", contextual.replace("<select>", '<select aria-labelledby="missing">'), false],
  ["wrong label target", `<div><label for="other">Status</label>${select}</div>`, false],
  ["value is not visible label", contextual.replace("<option selected>All statuses</option>", '<option value="All statuses" selected>Pending</option>'), false],
  ["distant label", `<div><p>Status</p>${select}</div>`, false],
  ["attribute-only label", `<div><span title="Status"></span>${select}</div>`, false],
  ["duplicate contextual controls", contextual + contextual, false],
  ["conflicting native label", `<label for="status">Supplier</label><div>Status${select.replace("<select>", '<select id="status">')}</div>`, false],
  ["disabled select", contextual.replace("<select>", "<select disabled>"), false],
  ["disabled fieldset", `<fieldset disabled>${contextual}</fieldset>`, false],
  ["no choices", "<div>Status<select><option>All statuses</option></select></div>", false],
  ["disabled option", contextual.replace("<option>Pending", "<option disabled>Pending"), false],
  ["disabled optgroup", contextual.replace("<option>Pending</option>", "<optgroup disabled><option>Pending</option></optgroup>"), false],
  ["duplicate option", contextual.replace("</select>", "<option>Pending</option></select>"), false],
];
for (const [id, cases] of [["request-facts", rows], ["status-filter", controls]] as const) {
  for (const [name, output, expected] of cases) {
    test(`usability ${id}: ${name}`, () => {
      const score = assessOutput(output, state, "input must not supply evidence");
      const result = score.requirements.find(item => item.id === id)!;
      assert.equal(result.passed, expected, result.reasons.join("\n"));
      assert.equal(score.outputBytes, Buffer.byteLength(output));
      assert.equal(score.reader.status, "ok");
    });
  }
}

test("inference provenance, strict diagnostic, exact bytes and inspection agree", () => {
  const output = `<div>${flat.replace("Morgan Lee", "MLMorgan Lee")}</div>${contextual}`;
  const score = assessOutput(output, state, output);
  assert.deepEqual(score, assessOutput(output, state, output));
  assert.equal(score.retention.overall.numerator, 2);
  assert.equal(score.semanticRetention.overall.numerator, 0);
  const facts = score.requirements[0]!;
  assert.equal(facts.match, "inferred");
  assert.deepEqual(facts.inferenceRules.sort(), ["hybrid-table", "person-name-initials"]);
  assert.deepEqual(score.requirements[2]!.inferenceRules, ["adjacent-control-label"]);
  const inspected = inspectEvidence(output, state, score);
  const dom = new JSDOM(inspected.html);
  try {
    for (const id of ["request-facts", "status-filter"]) {
      assert.equal(inspected.highlights[id]!.kind, "match");
      assert.ok(inspected.highlights[id]!.selectors.every(selector => dom.window.document.querySelector(selector)));
    }
  } finally { dom.window.close(); }
});

test("typed normalization is not a generic substring rule", () => {
  const untyped = structuredClone(state);
  for (const goal of untyped.requirements) for (const alternative of goal.evidence) for (const rule of alternative.allOf) {
    if (rule.kind === "record" || rule.kind === "properties") for (const field of rule.fields) delete field.valueType;
  }
  assert.equal(assessOutput(canonical.replace("Morgan Lee", "MLMorgan Lee"), untyped, "").requirements[0]!.passed, false);
});

test("hybrid parsing never promotes code-literal buttons into controls", () => {
  const actionState = records.states[1]!;
  const table = '| Request | Action | | --- | --- | | RQ-1042 | `<button>View request</button>` |';
  const score = assessOutput(`<div>${table}</div>`, actionState, "");
  assert.equal(score.requirements.find(r => r.id === "view-request")!.passed, false);
});

test("custom combobox choices need an unambiguous retained listbox relationship", () => {
  const output = '<input role="combobox" aria-label="Status" value="All statuses" aria-controls="choices"><div role="listbox" id="choices">'
    + ["All statuses", "Pending", "Overdue", "Approved"].map(name => `<div role="option">${name}</div>`).join("") + "</div>";
  const check = (source: string) => assessOutput(source, state, "").requirements[2]!.passed;
  assert.equal(check(output), true);
  assert.equal(check(output.replace('aria-controls="choices"', 'aria-controls="missing"')), false);
  assert.equal(check(output.replace('id="choices"', 'id="choices" hidden')), false);
  assert.equal(check(output.replace(">Pending</div>", ' aria-disabled="true">Pending</div>')), false);
});
