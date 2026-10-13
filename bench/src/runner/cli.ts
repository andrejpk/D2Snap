import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { reportRoot } from "./artifacts.ts";
import { escapeHTML, reportDocument } from "./report.ts";
import { runDemo } from "./run.ts";
import { presentationOrder } from "./presentation-order.ts";
import { runSuite } from "./suite.ts";

try {
  const { values } = parseArgs({ options: {
    config: { type: "string" }, refresh: { type: "boolean" }, "assert-cached": { type: "boolean" },
    stack: { type: "string" }, variant: { type: "string" }, all: { type: "boolean" },
  } });
  const options = { config: values.config, refresh: values.refresh, assertCached: values["assert-cached"], stack: values.stack, variant: values.variant };
  const reports = values.all || !values.stack ? (await runSuite(options)).reports : [await runDemo(options)];
  for (const report of reports) {
  console.log(`Stack: ${report.stackId}`);
  console.table(presentationOrder(report.results).map(result => ({
    state: result.stateId, configuration: result.profileId,
    goals: `${result.assessment.retention.overall.numerator}/${result.assessment.retention.overall.denominator}`,
    KB: result.assessment.outputKB.toFixed(3), transform: result.cache.transform, score: result.cache.assessment,
  })));
  console.log("Fresh work:", report.counts);
  }
  console.log(`Report: ${join(reportRoot, "index.html")}\nPreview: pnpm --dir bench serve`);
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("Perception Bench failed:", message);
  await mkdir(reportRoot, { recursive: true });
  const failure = JSON.stringify({ schemaVersion: 1, status: "failed", message }, null, 2);
  await writeFile(join(reportRoot, "error.json"), failure);
  await writeFile(join(reportRoot, "results.json"), failure);
  await writeFile(join(reportRoot, "index.html"), reportDocument("Perception Bench failed",
    `<h1>Benchmark run failed</h1><p>No successful report was published for this invocation.</p><pre>${escapeHTML(message)}</pre>`));
  process.exitCode = 1;
}
