import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { records } from "../../../cases/records.ts";
import { assessOutput } from "../../../src/evidence/index.ts";
import { BrowserSession } from "../../../src/runner/browser.ts";
import type { Counts } from "../../../src/runner/models.ts";
import adapter from "../adapters/records.ts";
import { fixtureFiles } from "./fixture-files.ts";

const sha256 = (content: string) => createHash("sha256").update(content).digest("hex");

test("Fluent production raw goals and fresh HTML/screenshot determinism", async t => {
  const counts: Counts = { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 };
  const browser = new BrowserSession(await fixtureFiles(), counts);
  try {
    for (const state of records.states) {
      await t.test(state.id, async () => {
        const first = await browser.capture(state.id, adapter);
        const second = await browser.capture(state.id, adapter);
        const assessments = [first, second].map(capture => assessOutput(capture.html, state, capture.html, "html"));
        const expected = state.id === "browsing" ? 3 : 5;
        for (const assessment of assessments) {
          assert.equal(assessment.reader.status, "ok", JSON.stringify(assessment.reader));
          assert.equal(assessment.retention.overall.denominator, expected);
          assert.equal(assessment.retention.overall.numerator, expected, JSON.stringify(assessment.requirements.filter(goal => !goal.passed), null, 2));
          assert.equal(assessment.semanticRetention.overall.numerator, expected, "All raw goals must have explicit semantic evidence");
          assert.equal(assessment.fullFidelity, true);
        }
        assert.equal(sha256(second.html), sha256(first.html), "Fresh raw HTML/output must be byte-identical");
        assert.equal(sha256(second.screenshot), sha256(first.screenshot), "Fresh full-page PNGs must be byte-identical");
        assert.deepEqual(assessments[1], assessments[0], "Fresh raw output assessments must be identical");
        t.diagnostic(`${state.id}: raw ${expected}/${expected}, semantic ${expected}/${expected}; HTML ${Buffer.byteLength(first.html)} bytes sha256=${sha256(first.html)}; PNG ${Buffer.from(first.screenshot, "base64").length} bytes sha256=${sha256(first.screenshot)}`);
      });
    }
    assert.equal(counts.browserLaunches, 1);
  } finally {
    await browser.close();
  }
});
