import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { reportRoot } from "./artifacts.ts";
import { filesSchema, reportSchema, suiteReportSchema } from "./models.ts";
import { renderReport, renderSuite } from "./report.ts";
import { parseArgs } from "node:util";
import { cellId } from "./cell-id.ts";

try {
  const { values } = parseArgs({ options: { all: { type: "boolean" } } });
  const saved: unknown = JSON.parse(await readFile(join(reportRoot, values.all ? "suite.json" : "results.json"), "utf8"));
  const matrix = suiteReportSchema.safeParse(saved);
  if (matrix.success) {
    const suite = matrix.data;
    const files = Object.fromEntries(await Promise.all(suite.reports.map(async report => [cellId(report),
      filesSchema.parse(JSON.parse(await readFile(join(reportRoot, "cells", cellId(report), "fixture.json"), "utf8")))])));
    await writeFile(join(reportRoot, "index.html"), renderSuite(suite, files));
  } else {
  const report = reportSchema.parse(saved);
  const files = filesSchema.parse(JSON.parse(await readFile(join(reportRoot, "fixture.json"), "utf8")));
  await writeFile(join(reportRoot, "index.html"), renderReport(report, files));
  }
  console.log(`Rebuilt standalone report without running benchmark stages: ${join(reportRoot, "index.html")}`);
} catch (error) {
  console.error("Report rebuild failed. Run the demo once to produce valid current report data.", error);
  process.exitCode = 1;
}
