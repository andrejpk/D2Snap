import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { reportRoot } from "./artifacts.ts";
import { filesSchema } from "./models.ts";
import { idSchema } from "../contracts.ts";
import { matrix } from "../matrix.ts";
import { cellId } from "./cell-id.ts";
import { startServer } from "./server.ts";

const { values } = parseArgs({ options: { port: { type: "string", default: "4177" }, stack: { type: "string" }, variant: { type: "string" } } });
const port = z.coerce.number().int().min(1024).max(65535).parse(values.port);
const selected = values.stack ? matrix.filter(cell => cell.caseId === "records" && cell.status === "registered"
  && cell.stackId === idSchema.parse(values.stack) && (!values.variant || cell.variantId === idSchema.parse(values.variant))) : [];
if (values.stack && selected.length !== 1) throw new Error("Choose one registered stack/variant to serve.");
const root = selected[0] ? join(reportRoot, "cells", cellId(selected[0])) : reportRoot;
const files = filesSchema.parse(JSON.parse(await readFile(join(root, "fixture.json"), "utf8")));
const server = await startServer(files, root, port);
console.log(`Report: ${server.url}/\nInteractive fixture: ${server.url}/fixture/?clawpilotTheme=light`);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void server.close().catch(error => { console.error(error); process.exitCode = 1; }); });
}
