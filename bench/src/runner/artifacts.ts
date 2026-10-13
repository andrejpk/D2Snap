import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { build, version as esbuildVersion } from "esbuild";
import { z } from "zod";
import { CacheStore, canonicalJson, fixtureBuildKey, hashManifest, sha256 } from "../cache/index.ts";
import type { CacheOutcome, JsonValue, Sha256 } from "../cache/index.ts";
import { filesSchema } from "./models.ts";
import type { Counts } from "./models.ts";

export const benchRoot = resolve(import.meta.dirname, "..", "..");
export const repoRoot = resolve(benchRoot, "..");
export const stackRoot = join(benchRoot, "stacks", "react-shadcn");
export const reportRoot = join(benchRoot, "reports", "latest");
export const requireBench = createRequire(join(benchRoot, "package.json"));
const exec = promisify(execFile);

export function jsonValue(value: unknown): JsonValue {
  // canonicalJson validates that every value is representable before parsing.
  return JSON.parse(canonicalJson(value)) as JsonValue;
}

export async function fileHash(path: string): Promise<Sha256> {
  return sha256(await readFile(path));
}

export async function treeFiles(root: string, excluded: readonly string[] = []): Promise<string[]> {
  const paths: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (excluded.includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in artifact sources: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) paths.push(path);
    }
  }
  await walk(root);
  return paths.sort();
}

export async function treeHashes(root: string, excluded: readonly string[] = []): Promise<Record<string, Sha256>> {
  return Object.fromEntries(await Promise.all((await treeFiles(root, excluded))
    .map(async path => [relative(root, path).replaceAll("\\", "/"), await fileHash(path)])));
}

export function logOutcome(stage: string, outcome: CacheOutcome): void {
  if (outcome.status !== "hit" && outcome.prior.status === "corrupt") {
    console.warn(`${stage}: recovering corrupt cache entry: ${outcome.prior.diagnostic}`);
  }
  console.log(`${stage}: ${outcome.status} ${outcome.key.slice(0, 12)}`);
}

export async function fixtureArtifact(store: CacheStore, counts: Counts, refresh: boolean, stackId = "react-shadcn") {
  const appRoot = join(benchRoot, "stacks", stackId);
  const requireStack = createRequire(join(appRoot, "package.json"));
  const angular = stackId === "angular-material-ag-grid";
  const builderPackage = requireStack.resolve(angular ? "@angular/cli/package.json" : "vite/package.json");
  const builder = z.object({ version: z.string() }).parse(JSON.parse(await readFile(builderPackage, "utf8")));
  const sources = await treeHashes(appRoot, [
    "node_modules", "dist", "adapters", "README.md", ".angular", ".svelte-kit",
    "tests", "smoke.mjs", "validate.mjs", "validation-artifacts", "test-results", "playwright-report",
  ]);
  const data = await treeHashes(join(benchRoot, "packages", "scenarios"), ["node_modules"]);
  const key = fixtureBuildKey({
    dependencyClosure: { ...sources, ...Object.fromEntries(Object.entries(data).map(([key, value]) => [`scenarios/${key}`, value])) },
    lockfileHash: await fileHash(join(benchRoot, "pnpm-lock.yaml")),
    buildConfig: { mode: "production", base: "/fixture/", builder: angular ? "angular-cli" : "vite-cli", builderHash: await fileHash(import.meta.filename) },
    toolchain: { node: process.versions.node, builder: builder.version, platform: process.platform, arch: process.arch },
    environment: { NODE_ENV: "production" },
  });
  const outcome = await store.getOrCreate(key, async () => {
    counts.fixtureBuilds++;
    const builds = join(benchRoot, ".cache", "builds");
    await mkdir(builds, { recursive: true });
    const output = await mkdtemp(join(builds, "fixture-"));
    try {
      const args = angular
        ? [join(dirname(builderPackage), "bin", "ng.js"), "build", "--configuration=production", "--base-href=/fixture/", "--output-path", output]
        : [join(dirname(builderPackage), "bin", "vite.js"), "build", "--base=/fixture/", "--outDir", output, "--emptyOutDir"];
      try {
        await exec(process.execPath, args, {
          cwd: appRoot, env: { ...process.env, NODE_ENV: "production", NG_CLI_ANALYTICS: "false" }, maxBuffer: 10_000_000,
        });
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        const output = typeof error === "object" && error && "stderr" in error ? String(error.stderr) : "";
        throw new Error(`Fixture build failed for ${stackId}: ${details}\n${output}`, { cause: error });
      }
      const files = Object.fromEntries(await Promise.all((await treeFiles(output)).map(async path => [
        relative(output, path).replaceAll("\\", "/").replace(angular ? /^browser\// : /^$/, ""), (await readFile(path)).toString("base64"),
      ])));
      if (!files["index.html"]) throw new Error("Fixture build did not emit index.html");
      return { status: "completed", deterministic: true, value: files };
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  }, { refresh });
  logOutcome(`${stackId} fixture build`, outcome);
  const files = filesSchema.parse(outcome.result.value);
  return { files, hash: hashManifest("perception-bench.fixture-files", 1, files), key };
}

export async function subjectArtifact(store: CacheStore, counts: Counts, refresh: boolean) {
  const entry = join(import.meta.dirname, "subject.browser.js");
  const adapterHash = hashManifest("perception-bench.subject-adapter", 1, {
    entry: await fileHash(entry),
    options: await fileHash(join(import.meta.dirname, "subject-options.ts")),
  });
  const key = hashManifest("perception-bench.subject-build", 1, {
    sources: await treeHashes(join(repoRoot, "src")),
    packageHash: await fileHash(join(repoRoot, "package.json")),
    lockfileHash: await fileHash(join(benchRoot, "pnpm-lock.yaml")),
    adapterHash,
    builderHash: await fileHash(import.meta.filename),
    build: { esbuild: esbuildVersion, platform: "browser", format: "iife", target: "es2022", minify: false },
  });
  const outcome = await store.getOrCreate(key, async () => {
    counts.subjectBuilds++;
    const result = await build({
      entryPoints: [entry], absWorkingDir: repoRoot,
      nodePaths: [join(benchRoot, "node_modules")],
      bundle: true, write: false, platform: "browser", format: "iife",
      target: "es2022", minify: false, external: ["jsdom"], logLevel: "warning",
    });
    if (result.outputFiles.length !== 1) throw new Error("Expected one subject browser bundle");
    return { status: "completed", deterministic: true, value: result.outputFiles[0]!.text };
  }, { refresh });
  logOutcome("subject build", outcome);
  const code = z.string().min(1).parse(outcome.result.value);
  return { code, hash: sha256(code), adapterHash, key };
}
