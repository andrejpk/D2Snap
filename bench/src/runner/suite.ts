import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { matrix } from "../matrix.ts";
import { reportRoot } from "./artifacts.ts";
import { filesSchema } from "./models.ts";
import type { DemoReport, SuiteReport } from "./models.ts";
import { runDemo } from "./run.ts";
import type { DemoOptions } from "./run.ts";
import { renderSuite } from "./report.ts";
import { cellId } from "./cell-id.ts";

export async function runSuite(options: DemoOptions = {}): Promise<SuiteReport> {
  const cells = matrix.filter(cell => cell.caseId === "records" && cell.status === "registered"
    && (!options.stack || cell.stackId === options.stack) && (!options.variant || cell.variantId === options.variant));
  if (!cells.length) throw new Error("No registered records cells selected.");
  const reports: DemoReport[] = [];
  const assets: Record<string, Record<string, string>> = {};
  for (const cell of cells) {
    const destination = join(reportRoot, "cells", cellId(cell));
    const report = await runDemo({ ...options, stack: cell.stackId, variant: cell.variantId, destination, requireRawFidelity: true });
    reports.push(report);
    assets[cellId(cell)] = filesSchema.parse(JSON.parse(await readFile(join(destination, "fixture.json"), "utf8")));
    const incomplete = report.results.filter(result => result.profileId === "raw" && !result.assessment.fullFidelity);
    if (incomplete.length) {
      throw new Error(`Raw goals failed for ${cell.stackId}: ${incomplete.map(result =>
        `${result.stateId}: ${result.assessment.requirements.filter(goal => !goal.passed).map(goal => `${goal.id} (${goal.reasons.join("; ")})`).join(", ")}`).join("\n")}`);
    }
  }
  const suite: SuiteReport = { schemaVersion: 1, kind: "matrix", generatedAt: new Date().toISOString(), reports };
  await mkdir(reportRoot, { recursive: true });
  await writeFile(join(reportRoot, "suite.json"), JSON.stringify(suite, null, 2));
  await writeFile(join(reportRoot, "results.json"), JSON.stringify(suite, null, 2));
  await writeFile(join(reportRoot, "fixture.json"), JSON.stringify(assets[cellId(reports[0]!)]));
  await writeFile(join(reportRoot, "index.html"), renderSuite(suite, assets));
  await rm(join(reportRoot, "error.json"), { force: true });
  return suite;
}
