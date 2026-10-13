import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { records } from "../../src/matrix.ts";
import { assessOutput, inspectEvidence } from "../../src/evidence/index.ts";
import { makePreview, sanitizePreview } from "../../src/runner/preview.ts";
import { positiveControls, wrongActionAssociations } from "../cases/controls.ts";

test("inspection locates passing goals without changing output or verdicts", () => {
  const state = records.states.find(state => state.id === "target-actions-available")!;
  const original = positiveControls["records/target-actions-available"]!;
  const assessment = assessOutput(original, state, original, "html");
  const before = JSON.stringify(assessment);
  const preview = makePreview(original, state, assessment);
  const dom = new JSDOM(preview.document);
  try {
    for (const requirement of state.requirements) {
      const highlight = preview.highlights[requirement.id]!;
      assert.equal(highlight.kind, "match", requirement.id);
      assert.ok(highlight.selectors.length > 0);
      for (const selector of highlight.selectors) assert.equal(dom.window.document.querySelectorAll(selector).length, 1);
    }
    assert.equal(JSON.stringify(assessment), before);
    assert.equal(assessment.outputBytes, Buffer.byteLength(original, "utf8"));
    assert.ok(!original.includes("data-bench-view-node"));
  } finally { dom.window.close(); }
});

test("unassociated controls are context, never promoted to successful matches", () => {
  const state = records.states.find(state => state.id === "target-actions-available")!;
  const output = wrongActionAssociations[0]!;
  const assessment = assessOutput(output, state, output, "html");
  assert.equal(assessment.requirements.find(item => item.id === "view-request")?.passed, false);
  const inspection = inspectEvidence(output, state, assessment);
  assert.equal(inspection.highlights["view-request"]?.kind, "context");
  assert.ok(inspection.highlights["view-request"]!.selectors.length > 0);
  assert.match(inspection.highlights["view-request"]!.explanation, /not a successful match/);
  const empty = inspectEvidence("", state, assessOutput("", state, output, "html"));
  assert.equal(empty.highlights["view-request"]?.kind, "none");
  assert.deepEqual(empty.highlights["view-request"]?.selectors, []);
});

test("preview renders the README's nested HTML/Markdown without changing scoring grammar", () => {
  const input = `<section class="container">
    # Our Pizza
    <div>
      ## Margherita
      A **simple classic**: mozzarella, tomatoes and basil.
      <button>Add</button>
    </div>
  </section>`;
  const dom = new JSDOM(sanitizePreview(input, "", true));
  try {
    assert.equal(dom.window.document.querySelector("h1")?.textContent, "Our Pizza");
    assert.equal(dom.window.document.querySelector("h2")?.textContent, "Margherita");
    assert.equal(dom.window.document.querySelector("strong")?.textContent, "simple classic");
    assert.equal(dom.window.document.querySelector("button")?.textContent, "Add");
  } finally { dom.window.close(); }
});

test("preview removes active content and external dependencies, including rendered Markdown links", () => {
  const input = `<body onload="alert(1)"><script>alert(1)</script><iframe srcdoc="<script>alert(1)</script>"></iframe>
    <meta http-equiv="refresh" content="0; url=https://example.com"><base href="https://example.com">
    <img src="/fixture/logo.png" onerror="alert(1)"><img src="https://example.com/tracker">
    <a href="javascript:alert(1)" onclick="alert(1)">Bad</a>
    <div>[Remote](https://example.com)</div>
    <form action="https://example.com"><button formaction="https://example.com">Send</button></form></body>`;
  const dom = new JSDOM(sanitizePreview(input, '@import "https://example.com/x.css"; body { background:url(https://example.com/x); }', true, {
    "logo.png": Buffer.from("image").toString("base64"),
  }));
  try {
    const document = dom.window.document;
    assert.equal(document.querySelectorAll("script,iframe,object,embed,base,link").length, 0);
    assert.equal(document.querySelectorAll("[onclick],[onerror],[onload],[action],[formaction],[srcdoc]").length, 0);
    assert.equal(document.querySelectorAll('a[href]').length, 0);
    assert.match(document.querySelector("img")?.getAttribute("src") ?? "", /^data:image\/png;base64,/);
    assert.ok(!document.querySelector("style")?.textContent?.includes("example.com"));
    assert.match(document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? "", /script-src 'none'/);
    assert.equal(document.querySelectorAll('meta[http-equiv="refresh"]').length, 0);
  } finally { dom.window.close(); }
});
