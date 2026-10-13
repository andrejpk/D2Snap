import { mkdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";
import type { DemoReport, DemoResult, SuiteReport } from "./models.ts";
import { makeViewerData } from "./preview.ts";
import { themeCSS, themeScript } from "./theme.ts";
import { sizeBar } from "./size-bar.ts";
import { presentationOrder } from "./presentation-order.ts";
import { cellId } from "./cell-id.ts";

export function escapeHTML(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function reportDocument(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<script>${themeScript}</script><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)}</title><style>${themeCSS}</style></head><body><main>${body}</main></body></html>`;
}
function fraction(result: DemoResult, category: "content" | "control" | "overall"): string {
  const value = result.assessment.retention[category];
  return value.denominator === 0 ? "N/A" : `${value.numerator}/${value.denominator}`;
}
function sizeCell(result: DemoResult, report: DemoReport): string {
  const maximum = Math.max(0, ...report.results.filter(item => item.stateId === result.stateId).map(item => item.assessment.outputBytes));
  const size = sizeBar(result.assessment.outputBytes, maximum);
  return `<td class="bench-size-cell bench-numeric" title="${escapeHTML(size.description)}" aria-label="${escapeHTML(size.description)}"><span class="bench-size-track" aria-hidden="true"><span class="bench-size-bar" style="width:${size.percentage}%"></span></span><span class="bench-size-value">${size.kb}</span></td>`;
}
export function renderReport(report: DemoReport, files: Record<string, string> = {}): string {
  const data = makeViewerData(report, files);
  return renderViewer(data, report);
}

export function renderSuite(report: SuiteReport, files: Record<string, Record<string, string>>): string {
  return renderViewer({ schemaVersion: 1, kind: "matrix", generatedAt: report.generatedAt, cells: report.reports.map(cell => {
    const assets = files[cellId(cell)];
    if (!assets) throw new Error(`Missing fixture assets for ${cellId(cell)}`);
    return makeViewerData(cell, assets);
  }) }, report.reports[0]!, report.reports);
}

function renderViewer(data: unknown, report: DemoReport, reports = [report]): string {
  const bundle = buildSync({
    entryPoints: [join(import.meta.dirname, "report-client.ts")],
    bundle: true, write: false, platform: "browser", format: "iife", target: "es2022",
    minify: true, logLevel: "warning",
  });
  if (bundle.outputFiles.length !== 1) throw new Error("Expected one report client bundle");
  const script = bundle.outputFiles[0]!.text.replace(/<\/script/gi, "<\\/script");
  const css = readFileSync(join(import.meta.dirname, "report-ui.css"), "utf8").replace(/<\/style/gi, "<\\/style");
  const embedded = JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
  const rawIncomplete = reports.some(cell => cell.results.some(result => result.profileId === "raw" && !result.assessment.fullFidelity));
  return reportDocument("Perception Bench | Records", `
<style>${css}</style><div id="bench-viewer">
<h1>Perception Bench</h1><noscript>Enable JavaScript for the side-by-side inspector. This file needs no server or internet connection.</noscript>
${rawIncomplete ? '<p class="notice">Raw evidence is incomplete. Investigate fixture, capture, or reader limitations first.</p>' : ""}
<table><thead><tr><th>State</th><th>Configuration</th><th>Content</th><th>Controls</th><th>All goals</th><th>Semantic</th><th>KB</th><th>Verdict</th></tr></thead><tbody>
${reports.flatMap(cell => presentationOrder(cell.results).map(result => `<tr><td>${escapeHTML(reports.length > 1 ? `${cell.stackId} / ${result.stateId}` : result.stateId)}</td><td>${escapeHTML(result.profileId)}</td>
<td>${fraction(result, "content")}</td><td>${fraction(result, "control")}</td><td>${fraction(result, "overall")}</td>
<td>${result.assessment.semanticRetention.overall.numerator}/${result.assessment.semanticRetention.overall.denominator}</td>
${sizeCell(result, cell)}<td>${result.assessment.fullFidelity ? "Retained" : "Missing"}</td></tr>`)).join("")}
</tbody></table></div><script type="application/json" id="bench-data">${embedded}</script><script>${script}</script>`);
}

export async function writeReport(root: string, report: DemoReport, files: Record<string, string>): Promise<void> {
  await mkdir(root, { recursive: true });
  await Promise.all([
    writeFile(join(root, "results.json"), JSON.stringify(report, null, 2)),
    writeFile(join(root, "fixture.json"), JSON.stringify(files)),
    ...Object.entries(report.captures).flatMap(([stateId, capture]) => [
      writeFile(join(root, `${stateId}.png`), Buffer.from(capture.screenshot, "base64")),
      writeFile(join(root, `${stateId}.input.txt`), capture.html),
    ]),
    ...report.results.map(result => writeFile(join(root, `${result.stateId}.${result.profileId}.output.txt`), result.output)),
  ]);
  await writeFile(join(root, "index.html"), renderReport(report, files));
  await rm(join(root, "error.json"), { force: true });
}
