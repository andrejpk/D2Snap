import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaseState, EvidenceRule, Scope } from "../../src/contracts.ts";
import { assessOutput, READER_LIMITS, READER_VERSION } from "../../src/evidence/index.ts";

const page: Scope = { kind: "page" };
const row: Scope = { kind: "row", anchor: "PR-120" };
const text = (value: string, scope: Scope = page): EvidenceRule => ({ kind: "text", scope, text: value });
const button = (scope: Scope = page): EvidenceRule => ({ kind: "control", scope, role: "button", name: "Approve" });
function state(...rules: EvidenceRule[]): CaseState {
  return {
    id: "test-state", revision: 1, description: "Independent evidence contract.",
    preparation: ["Prepare fixture."], readyWhen: ["Fixture is ready."],
    requirements: rules.map((rule, index) => ({
      id: `requirement-${index}`, category: rule.kind === "control" ? "control" : "content",
      goal: `Requirement ${index}`, evidence: [{ id: "standard", allOf: [rule] }],
    })),
  };
}
function passes(output: string, ...rules: EvidenceRule[]): void {
  const result = assessOutput(output, state(...rules), "raw input that must not supply answers");
  assert.equal(result.reader.status, "ok", JSON.stringify(result.reader));
  assert.equal(result.fullFidelity, true, JSON.stringify(result.requirements));
}
function fails(output: string, ...rules: EvidenceRule[]): void {
  const result = assessOutput(output, state(...rules), "<button>Approve</button> PR-120 Acme 120");
  assert.equal(result.fullFidelity, false, JSON.stringify(result));
  assert.ok(result.requirements.some(item => item.reasons.length));
}
const record: EvidenceRule = {
  kind: "record", scope: { kind: "row", anchor: "PR-120" },
  fields: [{ label: "Supplier", value: "Acme" }, { label: "Amount", value: "120" }],
};
const table = (cells = "<td>Acme</td><td>120</td>", extra = ""): string =>
  `<table><thead><tr><th>Request</th><th>Supplier</th><th>Amount</th><th>Actions</th></tr></thead>
  <tbody><tr><td>PR-120</td>${cells}<td><button>Approve</button></td></tr>${extra}</tbody></table>`;

test("equivalent controls fulfill one goal, even when multiple representations are present", () => {
  const contract = state(button());
  contract.requirements[0]!.evidence = [
    { id: "text-or-icon-button", allOf: [button()] },
    { id: "navigation", allOf: [{ kind: "control", scope: page, role: "link", name: "Review approval" }] },
  ];
  for (const output of [
    "<button>Approve</button>",
    '<button><img src="approve.svg" alt="Approve"></button>',
    '<a href="/review">Review approval</a>',
    '<button>Approve</button><a href="/review">Review approval</a>',
  ]) {
    const result = assessOutput(output, contract, output, "html");
    assert.equal(result.fullFidelity, true);
    assert.deepEqual(result.retention.overall, { numerator: 1, denominator: 1, fraction: 1 });
    assert.ok(result.requirements[0]!.matchedAlternatives.length > 0);
    assert.deepEqual(result.requirements[0]!.reasons, []);
  }
});

test("partial evidence from different alternatives cannot be combined into a passing goal", () => {
  const contract = state(button());
  contract.requirements[0]!.evidence = [
    { id: "pending-approval", allOf: [button(), text("Pending")] },
    { id: "ready-review", allOf: [
      { kind: "control", scope: page, role: "link", name: "Review approval" }, text("Ready"),
    ] },
  ];
  const output = "<button>Approve</button><p>Ready</p>";
  const result = assessOutput(output, contract, output, "html");
  assert.equal(result.fullFidelity, false);
  assert.equal(result.requirements[0]!.alternatives.length, 2);
  assert.deepEqual(result.requirements[0]!.matchedAlternatives, []);
  assert.equal(assessOutput(output.replace("Ready", "Pending"), contract, output, "html").fullFidelity, true);
});

test("property goals accept definition lists or inline facts, not contradictory or unrelated values", () => {
  const rule: EvidenceRule = {
    kind: "properties", scope: { kind: "region", name: "Request" },
    fields: [{ label: "Supplier", value: "Acme" }, { label: "Amount", value: "120" }],
  };
  passes('<section aria-label="Request"><p>Supplier: <strong>Acme</strong></p><p>Amount: 120</p></section>', rule);
  passes('<section aria-label="Request"><dl><dt>Supplier</dt><dd>Acme</dd><dt>Amount</dt><dd>120</dd></dl></section>', rule);
  fails('<section aria-label="Request"><p>Supplier: Acme</p><p>Supplier: Other</p><p>Amount: 120</p></section>', rule);
  fails('<section aria-label="Request"><dl><dt>Supplier</dt><dd>Acme</dd><dd>Other</dd><dt>Amount</dt><dd>120</dd></dl></section>', rule);
  fails('<section aria-label="Request"><p>Supplier: Other</p><p>Amount: 120</p></section><p>Supplier: Acme</p>', rule);
  fails('<section aria-label="Request"><p>Acme 120</p></section>', rule);
});

test("declared HTML preserves indentation and blank lines without guessing Markdown intent", () => {
  const output = `
    <form>
      <label>Supplier <input value="Acme"></label>

      <button>Approve</button>
    </form>
  `;
  const contract = state(button(), {
    kind: "control", scope: page, role: "textbox", name: "Supplier", value: "Acme",
  });
  const html = assessOutput(output, contract, output, "html");
  assert.equal(html.fullFidelity, true, JSON.stringify(html.requirements));
  assert.equal(html.reader.format, "html");
  assert.equal(html.outputBytes, Buffer.byteLength(output, "utf8"));
  // In Markdown this is deliberately an indented code block, not a live form.
  const markdown = assessOutput(output, contract, output, "html-markdown");
  assert.equal(markdown.fullFidelity, false);
  assert.equal(markdown.reader.format, "html-markdown");
});

test("HTML tables keep evidence after surrounding chrome is removed", () => {
  const output = `\n    ${table().replaceAll("\n", "\n    ")}`;
  const result = assessOutput(output, state(record, button(row)), output, "html");
  assert.equal(result.fullFidelity, true, JSON.stringify(result.requirements));
});

test("exact output only: empty output cannot borrow labels, values, or controls from input", () => {
  const result = assessOutput("", state(text("Acme"), button()), "<p>Acme</p><button>Approve</button>");
  assert.equal(result.fullFidelity, false);
  assert.deepEqual(result.retention.overall, { numerator: 0, denominator: 2, fraction: 0 });
  assert.equal(result.outputBytes, 0);
  assert.equal(result.sizeRatio, 0);
});

test("UTF-8 byte metrics, decimal KB, category N/A, and explicit zero denominator", () => {
  const output = "Žluťoučký 🦊";
  const result = assessOutput(output, state(text(output)), "é");
  assert.equal(result.outputBytes, Buffer.byteLength(output, "utf8"));
  assert.equal(result.outputKB, Buffer.byteLength(output, "utf8") / 1000);
  assert.equal(result.inputBytes, 2);
  assert.equal(result.sizeRatio, Buffer.byteLength(output, "utf8") / 2);
  assert.deepEqual(result.retention.control, { numerator: 0, denominator: 0, fraction: null });
  assert.equal(result.reader.version, READER_VERSION);
  for (const delivered of ["", "é"]) {
    const zero = assessOutput(delivered, state(text("é")), "");
    assert.equal(zero.sizeRatio, null);
    assert.equal(zero.sizeRatioStatus, "zero-input");
  }
  const onlyControl = assessOutput("<button>Approve</button>", state(button()), "input");
  assert.deepEqual(onlyControl.retention.content, { numerator: 0, denominator: 0, fraction: null });
});

test("retention counts whole requirements, not successful sub-checks", () => {
  const result = assessOutput(table("<td>Acme</td><td>999</td>"), state(record, button(row)), "input");
  assert.deepEqual(result.retention.content, { numerator: 0, denominator: 1, fraction: 0 });
  assert.deepEqual(result.retention.control, { numerator: 1, denominator: 1, fraction: 1 });
  assert.deepEqual(result.retention.overall, { numerator: 1, denominator: 2, fraction: 0.5 });
  assert.ok(result.requirements[0]?.checks.some(item => item.passed));
  assert.equal(result.requirements[0]?.verdict, "fail");
});

test("text supports HTML entities, inline emphasis and Markdown links, not arbitrary substrings", () => {
  passes("Request **PR-120** from [Acme & Sons](/supplier).", text("PR-120"), text("Acme & Sons"));
  passes("<p>Acme&nbsp;&amp; <em>Sons</em></p>", text("Acme & Sons"));
  passes("<p>Total: 120.</p>", text("120"));
  for (const output of ["1200", "1120", "120.00", "PR-120-2", "préAcme", "Acmeé", "foo120bar"]) {
    fails(output, text(output.includes("Acme") ? "Acme" : output.startsWith("PR") ? "PR-120" : "120"));
  }
  fails("<p>Acme</p><p>Sons</p>", text("Acme Sons"));
  fails("Acme Acme", text("Acme"));
  fails("<p>Acme</p><p>Acme</p>", text("Acme"));
});

test("script, style, comment, attributes, template and hidden distractor strings are not content", () => {
  for (const output of [
    "<script>Acme</script>", "<style>/* Acme */</style>", "<!-- Acme -->", '<div title="Acme"></div>',
    "<template>Acme</template>", "<noscript>Acme</noscript>", "<svg><text>Acme</text></svg>",
    '<p hidden>Acme</p>', '<p aria-hidden="true">Acme</p>', '<p style="display:none">Acme</p>',
    '<style>.gone { display:none }</style><p class="gone">Acme</p>',
  ]) fails(output, text("Acme"));
  fails('<script id="label">Approve</script><button aria-labelledby="label"></button>', button());
});

test("output is never an executable page", () => {
  fails('<script>document.body.innerHTML="<button>Approve</button>"</script>', button());
  fails('<img src="https://invalid.example/image" onerror="this.outerHTML=\'<button>Approve</button>\'">', button());
});

test("native table record and row-scoped repeated action", () => {
  passes(table(undefined, "<tr><td>PR-121</td><td>Other</td><td>900</td><td><button>Approve</button></td></tr>"),
    record, button(row));
  fails(table(undefined, "<tr><td>PR-121</td><td>Other</td><td>900</td><td><button>Approve</button></td></tr>"),
    button());
});

test("GFM tables retain exact header associations and inline HTML controls", () => {
  passes(`| Request | Supplier | Amount | Actions |
| --- | --- | ---: | --- |
| **PR-120** | [Acme](/supplier) | 120 | <button>Approve</button> |
| PR-121 | Other | 900 | <button>Approve</button> |`, record, button(row));
});

test("ARIA grids retain row/cell/header semantics, including sparse explicit indices", () => {
  passes(`<div role="grid">
    <div role="row"><span role="columnheader">Request</span><span role="columnheader">Supplier</span><span role="columnheader">Amount</span></div>
    <div role="row"><span role="rowheader">PR-120</span><span role="gridcell">Acme</span><span role="gridcell">120</span></div>
  </div>`, record);
  passes(`<div role="grid">
    <div role="row"><span role="columnheader" aria-colindex="1">Request</span><span role="columnheader" aria-colindex="4">Supplier</span><span role="columnheader" aria-colindex="7">Amount</span></div>
    <div role="row"><span role="gridcell" aria-colindex="1">PR-120</span><span role="gridcell" aria-colindex="4">Acme</span><span role="gridcell" aria-colindex="7">120</span></div>
  </div>`, record);
});

test("explicit output-local headers references can survive reordered columns", () => {
  passes(`<table><tr><th id="req">Request</th><th id="amount">Amount</th><th id="supplier">Supplier</th></tr>
    <tr><td headers="req">PR-120</td><td headers="supplier">Acme</td><td headers="amount">120</td></tr></table>`, record);
});

test("records fail wrong associations, absent headers, bag-of-values, contradictory or duplicate rows", () => {
  fails(table("<td>120</td><td>Acme</td>"), record);
  fails(table("<td>Acme Other</td><td>120</td>"), record);
  fails(table("<td>Acme</td><td>1200</td>"), record);
  fails(table("<td>Acme</td><td>120 999</td>"), record);
  fails("<p>PR-120 Acme 120</p>", record);
  fails('<div role="row"><span role="cell">PR-120</span><span role="cell">Acme</span><span role="cell">120</span></div>', record);
  fails("<table><tr><td>PR-120</td><td>Acme</td><td>120</td></tr></table>", record);
  fails(table(undefined, "<tr><td>PR-120</td><td>Other</td><td>120</td><td></td></tr>"), record);
  fails(table("<td>Acme</td><td>120</td>").replace("Supplier", "Other"), record);
  fails(table("<td>Acme</td><td>120</td>").replace("Amount", "Supplier"), record);
});

test("records fail broken/duplicate header references and unsupported implicit spans", () => {
  fails(table('<td headers="absent">Acme</td><td>120</td>'), record);
  fails(table('<td colspan="2">Acme</td><td>120</td>'), record);
  fails(table().replace("<th>Supplier</th>", '<th id="same">Supplier</th>').replace("<th>Amount</th>", '<th id="same">Amount</th>')
    .replace("<td>Acme</td>", '<td headers="same">Acme</td>'), record);
  fails(table().replace("<td>120</td>", ""), record);
  fails(table().replace("<td>Acme</td>", '<td aria-colindex="3">Acme</td>'), record);
});

test("nested unrelated tables cannot fill outer row fields", () => {
  fails(table("<td>Other<table><tr><td>Acme</td></tr></table></td><td>120</td>"), record);
});

test("named regions and dialogs keep duplicate labels in separate scopes", () => {
  const scope: Scope = { kind: "dialog", name: "Approve request" };
  passes(`<section aria-label="Summary"><button>Approve</button></section>
    <div role="dialog" aria-labelledby="title"><h2 id="title">Approve request</h2><button>Approve</button></div>`,
  button(scope), button({ kind: "region", name: "Summary" }));
  fails('<div role="dialog" aria-label="Other"><button>Approve</button></div>', button(scope));
  fails('<div role="dialog"><h2>Approve request</h2><button>Approve</button></div>', button(scope));
  fails('<div role="dialog" aria-label="Approve request"><button>Approve</button></div>'.repeat(2), button(scope));
  fails('<button>Approve</button>', button(scope));
  fails('<div role="dialog" aria-label="Approve request" aria-labelledby="missing"><button>Approve</button></div>', button(scope));
  fails('<div role="dialog" aria-labelledby="duplicate"><h2 id="duplicate">Approve request</h2><p id="duplicate">Other</p><button>Approve</button></div>', button(scope));
  passes('<section aria-labelledby="summary"><div><h2 id="summary">Summary</h2><button>Approve</button></div></section>',
    button({ kind: "region", name: "Summary" }));
});

test("Markdown heading sections nest and end at the next peer heading", () => {
  const summary: Scope = { kind: "region", name: "Summary" };
  const other: Scope = { kind: "region", name: "Other" };
  passes(`# Request

## Summary
From **Acme**.

<button>Approve</button>

### Details
Retained details.

## Other
Other supplier.

<button>Approve</button>`, text("Acme", summary), text("Retained details", summary), button(summary), button(other));
  fails("## Summary\n\nNothing.\n\n## Other\n\nAcme", text("Acme", summary));
  fails("## Summary\n\nAcme\n\n## Summary\n\nOther", text("Acme", summary));
  passes("Summary\n=======\n\nAcme", text("Acme", summary));
});

test("inline Markdown emphasis/links can surround retained HTML controls", () => {
  passes('Approve **Acme** using <button aria-label="Approve">Continue</button> or [help](/help).',
    text("Acme"), button(), { kind: "control", scope: page, role: "link", name: "help" });
  fails("**Approve**", button());
  fails("`<button>Approve</button>`", button());
  fails("```html\n<button>Approve</button>\n```", button());
});

test("native and ARIA control names use accessible semantics with exact normalization", () => {
  passes('<button><span>  Approve \n </span></button>', button());
  passes('<div role="button" aria-label="Approve"></div>', button());
  passes('<span id="label">Approve</span><div role="button" aria-labelledby="label"></div>', button());
  passes('<label for="s">Supplier</label><input id="s" value="Acme">', {
    kind: "control", scope: page, role: "textbox", name: "Supplier", value: "Acme",
  });
  for (const output of ["<span>Approve</span>", "<button>Approve request</button>", '<button title="Other">Approve request</button>', "<a>Approve</a>"]) {
    fails(output, button());
  }
  fails('<button></button>', button());
  fails('<button>Approve</button><button aria-label="Approve">Other</button>', button());
});

test("broken or ambiguous accessible-name IDREFs cannot silently fall back", () => {
  fails('<button aria-label="Approve" aria-labelledby="absent"></button>', button());
  fails('<span id="label">Approve</span><span id="label">Other</span><button aria-labelledby="label"></button>', button());
  fails('<label for="s">Supplier</label><input id="s"><p id="s">Other</p>', {
    kind: "control", scope: page, role: "textbox", name: "Supplier",
  });
});

test("hidden and nonrendered controls do not provide interactive evidence", () => {
  for (const output of [
    '<button hidden>Approve</button>', '<div aria-hidden="true"><button>Approve</button></div>',
    '<button style="display:none">Approve</button>', '<button style="visibility:hidden">Approve</button>',
    '<style>.gone{display:none}</style><div class="gone"><button>Approve</button></div>',
    '<div inert><button>Approve</button></div>', '<input type="hidden" role="button" aria-label="Approve">',
    '<details><summary>Details</summary><button>Approve</button></details>',
  ]) fails(output, button());
  passes('<button hidden>Approve</button><button>Approve</button>', button());
  passes('<details open><summary>Details</summary><button>Approve</button></details>', button());
});

test("controlled popups require one target-row trigger and an unambiguous local scope", () => {
  const action: EvidenceRule = {
    kind: "control", scope: { kind: "controlled-popup", anchor: "RQ-1042" },
    role: "button", name: "Approve",
  };
  const trigger = '<button aria-expanded="true" aria-controls="popup">Actions</button>';
  const output = `<main id="page"><table><tr><td>RQ-1042</td><td>${trigger}</td></tr></table>
    <div id="popup"><button>Approve</button></div></main>`;
  passes(output, action);
  fails(output.replace(trigger, `${trigger}<button aria-expanded="true" aria-controls="missing">More</button>`), action);
  fails(output.replace(trigger, `<table><tr><td>RQ-1043</td><td>${trigger}</td></tr></table>`), action);
  fails(output.replace('aria-controls="popup"', 'aria-controls="page"'), action);
  fails(`${output}<div id="popup"></div>`, action);
  fails(output.replace('aria-controls="popup"', 'aria-controls="popup missing"'), action);
});

test("native disabled defaults and boolean HTML attribute presence are correct", () => {
  const enabled: EvidenceRule = { kind: "control", scope: page, role: "button", name: "Approve", states: { disabled: false } };
  const disabled: EvidenceRule = { ...enabled, states: { disabled: true } };
  passes("<button>Approve</button>", enabled);
  passes('<button disabled="false">Approve</button>', disabled);
  fails('<button disabled>Approve</button>', enabled);
  fails('<button disabled aria-disabled="false">Approve</button>', disabled);
  passes('<button aria-disabled="true">Approve</button>', disabled);
  passes('<div role="button" aria-label="Approve" aria-disabled="false"></div>', enabled);
  passes('<div role="button" aria-label="Approve"></div>', enabled);
  passes('<a href="/approve">Approve</a>', { ...enabled, kind: "control", role: "link" });
  fails('<div role="button" aria-label="Approve" aria-disabled="true"></div>', enabled);
  passes('<div aria-disabled="true"><div role="button" aria-label="Approve"></div></div>', disabled);
  fails('<div aria-disabled="true"><button aria-disabled="false">Approve</button></div>', enabled);
});

test("disabled fieldsets, first-legend exception and outer fieldsets are respected", () => {
  const disabled: EvidenceRule = { kind: "control", scope: page, role: "button", name: "Approve", states: { disabled: true } };
  passes("<fieldset disabled><button>Approve</button></fieldset>", disabled);
  passes("<fieldset disabled><legend><button>Approve</button></legend></fieldset>", { ...disabled, states: { disabled: false } });
  passes("<fieldset disabled><legend>First</legend><legend><button>Approve</button></legend></fieldset>", disabled);
  passes("<fieldset disabled><fieldset><legend><button>Approve</button></legend></fieldset></fieldset>", disabled);
});

test("required and checked native defaults; custom boolean states require explicit evidence", () => {
  const required: EvidenceRule = { kind: "control", scope: page, role: "textbox", name: "Supplier", states: { required: true } };
  passes('<input aria-label="Supplier" required>', required);
  passes('<input aria-label="Supplier" aria-required="true">', required);
  passes('<input aria-label="Supplier">', { ...required, states: { required: false } });
  fails('<input aria-label="Supplier" required aria-required="false">', required);
  const checked: EvidenceRule = { kind: "control", scope: page, role: "checkbox", name: "Agree", states: { checked: true } };
  passes('<input type="checkbox" aria-label="Agree" checked>', checked);
  passes('<input type="checkbox" aria-label="Agree">', { ...checked, states: { checked: false } });
  passes('<div role="checkbox" aria-label="Agree" aria-checked="false"></div>', { ...checked, states: { checked: false } });
  fails('<div role="checkbox" aria-label="Agree"></div>', { ...checked, states: { checked: false } });
  fails('<input type="checkbox" aria-label="Agree" aria-checked="true">', checked);
  fails('<div role="checkbox" aria-label="Agree" aria-checked="mixed"></div>', checked);
});

test("selected and expanded ARIA evidence cannot be defaulted from absent states", () => {
  const tab: EvidenceRule = { kind: "control", scope: page, role: "tab", name: "Summary", states: { selected: false } };
  fails('<button role="tab">Summary</button>', tab);
  passes('<button role="tab" aria-selected="false">Summary</button>', tab);
  fails('<button role="tab" aria-selected="true">Summary</button>', tab);
  fails('<button>Approve</button>', { ...button(), kind: "control", role: "button", name: "Approve", states: { expanded: false } });
  passes('<button aria-expanded="false">Approve</button>', { kind: "control", scope: page, role: "button", name: "Approve", states: { expanded: false } });
  fails('<button aria-expanded="no">Approve</button>', { kind: "control", scope: page, role: "button", name: "Approve", states: { expanded: false } });
});

test("validation needs accessible description relationship, not adjacent matching error text", () => {
  const error: EvidenceRule = {
    kind: "control", scope: page, role: "textbox", name: "Supplier",
    states: { invalid: true }, description: "Supplier is required.",
  };
  passes('<label for="s">Supplier</label><input id="s" aria-invalid="true" aria-describedby="error"><p id="error">Supplier is required.</p>', error);
  fails('<label for="s">Supplier</label><input id="s" aria-invalid="true"><p>Supplier is required.</p>', error);
  fails('<label for="s">Supplier</label><input id="s" aria-describedby="error"><p id="error">Supplier is required.</p>', error);
  fails('<input aria-label="Supplier" aria-invalid="true" aria-describedby="missing"><p>Supplier is required.</p>', error);
  fails('<input aria-label="Supplier" aria-invalid="true" aria-describedby="error"><p id="error">Wrong error.</p><p>Supplier is required.</p>', error);
  fails('<input aria-label="Supplier" aria-invalid="true" aria-describedby="error"><p id="error">Supplier is required.</p><p id="error">Wrong error.</p>', error);
  passes('<input aria-label="Supplier" aria-invalid="true" aria-describedby="error"><p id="error" hidden>Supplier is required.</p>', error);
});

test("input and textarea values are properties; select values are selected visible labels", () => {
  const value: EvidenceRule = { kind: "control", scope: page, role: "textbox", name: "Supplier", value: "Acme" };
  passes('<input aria-label="Supplier" value="Acme">', value);
  passes('<textarea aria-label="Supplier">Acme</textarea>', value);
  fails('<input aria-label="Supplier"><p>Acme</p>', value);
  const select: EvidenceRule = { ...value, role: "combobox" };
  passes('<select aria-label="Supplier"><option value="opaque">Acme</option><option>Other</option></select>', select);
  passes('<select aria-label="Supplier"><option>Other</option><option selected value="opaque">Acme</option></select>', select);
  fails('<select aria-label="Supplier"><option selected>Other</option><option value="Acme">Acme</option></select>', select);
  fails('<select aria-label="Supplier"><option value="Acme">Opaque</option></select>', select);
});

test("corpus-compatible amount properties retain empty/zero values and linked validation", () => {
  const amount: EvidenceRule = {
    kind: "control", scope: page, role: "spinbutton", name: "Amount", value: "",
    states: { required: true },
  };
  passes('<label for="amount">Amount</label><input id="amount" type="number" required value="">', amount);
  const invalid: EvidenceRule = {
    ...amount, value: "0", states: { required: true, invalid: true },
    description: "Amount must be greater than zero.",
  };
  passes('<label for="amount">Amount</label><input id="amount" type="number" required value="0" aria-invalid="true" aria-describedby="error"><p id="error">Amount must be greater than zero.</p>', invalid);
  fails('<label for="amount">Amount</label><input id="amount" type="number" required value="">', invalid);
  fails('<label for="amount">Amount</label><input id="amount" type="number" required value="0">', amount);
});

test("corpus summary facts preserve inline label/value formatting without substring matches", () => {
  const scope: Scope = { kind: "region", name: "Request summary" };
  passes('<section aria-label="Request summary"><p><strong>Supplier:</strong> \n <em>Acme Supplies</em></p></section>',
    text("Supplier: Acme Supplies", scope));
  passes('## Request summary\n\n**Supplier:** [Acme Supplies](/supplier)', text("Supplier: Acme Supplies", scope));
  fails('<section aria-label="Request summary"><p>Supplier: Acme SuppliesPlus</p></section>',
    text("Supplier: Acme Supplies", scope));
});

test("custom combobox supports input or one coherent displayed value, rejects contradictions", () => {
  const combo: EvidenceRule = { kind: "control", scope: page, role: "combobox", name: "Supplier", value: "Acme" };
  passes('<input role="combobox" aria-label="Supplier" value="Acme">', combo);
  passes('<div role="combobox" aria-label="Supplier"><span>Acme</span></div>', combo);
  passes('<div role="combobox" aria-label="Supplier"><input value="Acme"></div>', combo);
  fails('<div role="combobox" aria-label="Supplier"><span>Acme Other</span></div>', combo);
  fails('<div role="combobox" aria-label="Supplier"><p>Acme</p><p>Other</p></div>', combo);
  fails('<div role="combobox" aria-label="Supplier"><input value="Acme"><input value="Other"></div>', combo);
  fails('<div role="combobox" aria-label="Supplier"><input value="Acme"><span>Other</span></div>', combo);
  fails('<input role="combobox" aria-label="Supplier" value="Acme" aria-valuetext="Other">', combo);
  fails('<div role="combobox" aria-label="Supplier" aria-valuetext="Acme"></div>', combo);
});

test("reader limits fail closed with explicit diagnostics, never zero-byte success", () => {
  const result = assessOutput("x".repeat(READER_LIMITS.outputBytes + 1), state(text("x")), "input");
  assert.equal(result.reader.status, "unsupported");
  assert.equal(result.fullFidelity, false);
  assert.equal(result.retention.overall.fraction, 0);
  assert.equal(result.outputBytes, READER_LIMITS.outputBytes + 1);
  const deep = assessOutput("<div>".repeat(140) + "Acme" + "</div>".repeat(140), state(text("Acme")), "input");
  assert.equal(deep.reader.status, "unsupported");
});
