import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "playwright";
import { z } from "zod";
import { dataset } from "@perception-bench/scenarios";
import { cases, matrix, variants } from "../matrix.ts";
import type { CellAdapter } from "../contracts.ts";
import { assessOutput, READER_VERSION } from "../evidence/index.ts";
import {
  assessmentKey, CacheStore, captureKey, hashManifest, implementationKey, sha256, transformKey,
} from "../cache/index.ts";
import type { Sha256 } from "../cache/index.ts";
import {
  benchRoot, fileHash, fixtureArtifact, jsonValue, logOutcome, reportRoot, requireBench,
  subjectArtifact, treeHashes,
} from "./artifacts.ts";
import { acquisitionPolicy, BrowserSession } from "./browser.ts";
import { assessmentSchema, captureSchema, planSchema } from "./models.ts";
import type { Configuration, Counts, DemoReport, DemoResult } from "./models.ts";
import { writeReport } from "./report.ts";
import { subjectOptions } from "./subject-options.ts";

export interface DemoOptions { config?: string; refresh?: boolean; assertCached?: boolean; stack?: string; variant?: string; destination?: string; requireRawFidelity?: boolean }

function isAdapter(value: unknown): value is CellAdapter<Page> {
  return typeof value === "object" && value !== null
    && "caseId" in value && typeof value.caseId === "string"
    && "stackId" in value && typeof value.stackId === "string"
    && "variantId" in value && typeof value.variantId === "string"
    && "prepare" in value && typeof value.prepare === "function"
    && "assertReady" in value && typeof value.assertReady === "function";
}

async function browserFingerprint(): Promise<Record<string, string>> {
  const playwrightPackage = requireBench.resolve("playwright/package.json");
  const version = z.object({ version: z.string() }).parse(JSON.parse(await readFile(playwrightPackage, "utf8"))).version;
  const corePackage = createRequire(playwrightPackage).resolve("playwright-core/package.json");
  const browsers = z.object({
    browsers: z.array(z.object({ name: z.string(), revision: z.string() })),
  }).parse(JSON.parse(await readFile(join(dirname(corePackage), "browsers.json"), "utf8"))).browsers;
  const chromium = browsers.find(browser => browser.name === "chromium");
  const shell = browsers.find(browser => browser.name === "chromium-headless-shell");
  if (!chromium || !shell) throw new Error("Pinned Chromium revisions are missing");
  return {
    playwright: version, chromium: chromium.revision, headlessShell: shell.revision,
    platform: process.platform, arch: process.arch, node: process.versions.node,
  };
}

export async function runDemo(options: DemoOptions = {}): Promise<DemoReport> {
  if (options.refresh && options.assertCached) throw new Error("--refresh and --assert-cached cannot be combined");
  const plan = planSchema.parse(JSON.parse(await readFile(
    resolve(benchRoot, options.config ?? "configs/poc.json"), "utf8",
  )));
  const selected = matrix.filter(cell => cell.caseId === "records" && cell.stackId === (options.stack ?? "react-shadcn")
    && (!options.variant || cell.variantId === options.variant) && cell.status === "registered");
  if (selected.length > 1) throw new Error("Multiple presentation variants match; specify --variant.");
  const cell = selected[0];
  if (!cell?.adapterModule || cell.status !== "registered") throw new Error("POC implementation is not registered");
  const records = cases.find(uxCase => uxCase.id === cell.caseId)!;
  const adapterFile = join(benchRoot, "stacks", cell.stackId, cell.adapterModule);
  const loaded = z.object({ default: z.custom<CellAdapter<Page>>(isAdapter, "Invalid records adapter") })
    .parse(await import(pathToFileURL(adapterFile).href));
  if (loaded.default.caseId !== cell.caseId || loaded.default.stackId !== cell.stackId || loaded.default.variantId !== cell.variantId) {
    throw new Error(`Adapter identity does not match registered cell ${cell.stackId}/${cell.caseId}/${cell.variantId}.`);
  }
  const runtime = await browserFingerprint();
  const counts: Counts = { fixtureBuilds: 0, subjectBuilds: 0, browserLaunches: 0, captures: 0, transforms: 0, assessments: 0 };
  const store = new CacheStore(join(benchRoot, ".cache", "artifacts"), { lockTimeoutMs: 120_000 });
  const refresh = options.refresh ?? false;
  const fixture = await fixtureArtifact(store, counts, refresh, cell.stackId);
  const subject = await subjectArtifact(store, counts, refresh);
  const implementationHash = implementationKey({
    caseId: cell.caseId, stackId: cell.stackId, variantId: cell.variantId,
    presentation: jsonObject(variants.find(variant => variant.id === cell.variantId)),
  });
  const captureCodeHash = hashManifest("perception-bench.capture-code", 1, {
    browser: await fileHash(join(import.meta.dirname, "browser.ts")),
    adapter: await fileHash(adapterFile),
    server: await fileHash(join(import.meta.dirname, "server.ts")),
  });
  const scorerHash = hashManifest("perception-bench.scorer", 1, {
    evidence: await treeHashes(join(benchRoot, "src", "evidence"), ["README.md"]),
    contracts: await fileHash(join(benchRoot, "src", "contracts.ts")),
  });
  const browser = new BrowserSession(fixture.files, counts);
  const report: DemoReport = {
    schemaVersion: 1, caseDefinition: records, generatedAt: new Date().toISOString(),
    caseId: cell.caseId, stackId: cell.stackId, variantId: cell.variantId,
    subject: { label: "Current worktree D2Snap", hash: subject.hash },
    fixtureHash: fixture.hash, browser: runtime, counts, captures: {}, results: [],
  };
  try {
    for (const state of records.states) {
      const recipe = { id: state.id, revision: state.revision, preparation: state.preparation, readyWhen: state.readyWhen };
      const captureId = captureKey({
        implementationHash, fixtureArtifactHash: fixture.hash, pageId: records.id,
        stateRecipe: recipe, seed: dataset.seed, captureCodeHash,
        validationContractHash: hashManifest("perception-bench.validation", 1, { recipe, dataset }),
        acquisitionPolicy, browserRevision: `${runtime.playwright}/${runtime.chromium}/${runtime.headlessShell}`,
        rendering: {
          viewport: dataset.environment.viewport, locale: dataset.environment.locale,
          timeZone: dataset.environment.timezoneId, clock: dataset.environment.clock,
          settings: { ...runtime, reducedMotion: "reduce", colorScheme: "light", randomSeed: dataset.seed },
        },
      });
      const captureOutcome = await store.getOrCreate(captureId, async () => {
        counts.captures++;
        return { status: "completed", deterministic: true, value: await browser.capture(state.id, loaded.default) };
      }, { refresh });
      logOutcome(`${state.id} capture`, captureOutcome);
      const capture = captureSchema.parse(captureOutcome.result.value);
      report.captures[state.id] = capture;
      const inputHash = sha256(capture.html);
      const configurations: (Configuration | null)[] = [
        null, ...plan.profiles.map(profile => ({ ...profile, options: plan.options })),
      ];
      for (const configuration of configurations) {
        const profileId = configuration?.id ?? "raw";
        let output = capture.html;
        let transformId: Sha256 | null = null;
        let transformStatus = "baseline";
        if (configuration) {
          const { id: _id, ...effective } = configuration;
          transformId = transformKey({
            inputHash, subjectArtifactHash: subject.hash, runtimeDependenciesHash: subject.hash,
            subjectAdapterHash: hashManifest("perception-bench.subject-replay", 1, {
              replay: captureCodeHash, subject: subject.adapterHash,
            }),
            requestedConfig: effective, resolvedConfig: { ...effective, options: subjectOptions(configuration.options) },
            configSchema: "d2snap-ground-truth-adapter-v1",
            runtimeFingerprint: runtime,
          });
          const transformed = await store.getOrCreate(transformId, async () => {
            counts.transforms++;
            return { status: "completed", deterministic: true, value: await browser.transform(capture.html, subject.code, configuration) };
          }, { refresh });
          logOutcome(`${state.id}/${profileId} transform`, transformed);
          output = z.string().parse(transformed.result.value);
          transformStatus = transformed.status;
        }
        const format = !configuration || configuration.options.skipMarkdown ? "html" : "html-markdown";
        const assessmentId = assessmentKey({
          inputHash, outputHash: sha256(output), oracleHash: hashManifest("perception-bench.state-oracle", 1, state),
          evidenceReaderHash: scorerHash, scorerHash,
          metricSchema: { id: "utf8-goal-usability-v2", format, reader: READER_VERSION }, tokenizer: null,
        });
        const assessed = await store.getOrCreate(assessmentId, () => {
          counts.assessments++;
          return { status: "completed", deterministic: true, value: jsonValue(assessOutput(output, state, capture.html, format)) };
        }, { refresh });
        logOutcome(`${state.id}/${profileId} assessment`, assessed);
        const result: DemoResult = {
          stateId: state.id, profileId, configuration,
          assessment: assessmentSchema.parse(assessed.result.value), output,
          captureKey: captureId, transformKey: transformId, assessmentKey: assessmentId,
          cache: { capture: captureOutcome.status, transform: transformStatus, assessment: assessed.status },
        };
        report.results.push(result);
        if (!configuration && options.requireRawFidelity && !result.assessment.fullFidelity) {
          await writeReport(options.destination ?? reportRoot, report, fixture.files);
          throw new Error(`Raw goals failed for ${cell.stackId}/${state.id}: ${result.assessment.requirements
            .filter(goal => !goal.passed).map(goal => `${goal.id}: ${goal.reasons.join("; ")}`).join("\n")}`);
        }
      }
    }
  } finally { await browser.close(); }
  if (options.assertCached && Object.values(counts).some(value => value !== 0)) {
    throw new Error(`Expected a fully cached run, observed fresh work: ${JSON.stringify(counts)}`);
  }
  await writeReport(options.destination ?? reportRoot, report, fixture.files);
  return report;
}

function jsonObject(value: unknown): Record<string, string> {
  return z.record(z.string()).parse(value);
}
