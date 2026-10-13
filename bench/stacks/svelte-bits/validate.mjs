import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { BrowserSession } from "../../src/runner/browser.ts";
import { assessOutput } from "../../src/evidence/index.ts";
import { records } from "../../cases/records.ts";
import adapter from "./adapters/records.ts";
import { fixtureFiles } from "./fixture-files.mjs";

const counts = { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 };
const session = new BrowserSession(await fixtureFiles(), counts);
const artifacts = new URL("./validation-artifacts/", import.meta.url);
await mkdir(artifacts, { recursive: true });
try {
  for (const state of records.states) {
    const captures = [];
    const assessments = [];
    for (let run = 1; run <= 2; run++) {
      const capture = await session.capture(state.id, adapter);
      counts.captures++;
      captures.push(capture);
      const assessment = assessOutput(capture.html, state, capture.html, "html");
      counts.assessments++;
      assessments.push(assessment);
      await writeFile(new URL(`${state.id}-${run}.html`, artifacts), capture.html);
      await writeFile(new URL(`${state.id}-${run}.png`, artifacts), Buffer.from(capture.screenshot, "base64"));
      await writeFile(new URL(`${state.id}-${run}.json`, artifacts), JSON.stringify(assessment, null, 2) + "\n");
      const expected = state.id === "browsing" ? 3 : 5;
      assert.equal(assessment.retention.overall.denominator, expected);
      assert.equal(assessment.retention.overall.numerator, expected,
        JSON.stringify(assessment.requirements.filter(requirement => !requirement.passed), null, 2));
      assert.equal(assessment.semanticRetention.overall.numerator, expected, "All raw goals must have explicit semantic evidence");
      assert.equal(assessment.fullFidelity, true);
      console.log(`PASS raw ${state.id}, fresh run ${run}: ${expected}/${expected} goals (explicit semantics)`);
    }
    assert.equal(captures[0].html, captures[1].html, `${state.id}: raw capture/output must be byte-identical`);
    assert.equal(captures[0].screenshot, captures[1].screenshot, `${state.id}: full-page screenshots must be byte-identical`);
    assert.deepEqual(assessments[0], assessments[1], `${state.id}: assessments must be identical`);
    console.log(`PASS deterministic ${state.id}: HTML/raw output, screenshot PNG, assessment`);
  }
  assert.equal(counts.captures, 4);
  assert.equal(counts.assessments, 4);
  console.log(JSON.stringify(counts));
} finally {
  await session.close();
}
