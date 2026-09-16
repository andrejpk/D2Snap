import {
  assertFields, assertObject, assertSha256, assertText, hashManifest,
} from "./canonical.ts";
import type { JsonObject, JsonValue, Sha256 } from "./canonical.ts";

export interface ImplementationManifest {
  caseId: string;
  stackId: string;
  variantId: string;
  presentation: JsonObject;
}

export function implementationKey(manifest: ImplementationManifest): Sha256 {
  validate(manifest, [], ["presentation"], ["caseId", "stackId", "variantId"]);
  return hashManifest("perception-bench.implementation", 1, manifest);
}

export interface FixtureBuildManifest {
  dependencyClosure: Record<string, Sha256>;
  lockfileHash: Sha256;
  buildConfig: JsonObject;
  toolchain: JsonObject;
  environment: Record<string, string>;
}

export interface CaptureManifest {
  implementationHash: Sha256;
  fixtureArtifactHash: Sha256;
  pageId: string;
  stateRecipe: JsonObject;
  seed: JsonValue;
  captureCodeHash: Sha256;
  validationContractHash: Sha256;
  acquisitionPolicy: JsonObject;
  browserRevision: string;
  rendering: {
    viewport: { width: number; height: number };
    locale: string;
    timeZone: string;
    clock: string;
    settings: JsonObject;
  };
}

export interface TransformManifest {
  inputHash: Sha256;
  subjectArtifactHash: Sha256;
  runtimeDependenciesHash: Sha256;
  subjectAdapterHash: Sha256;
  requestedConfig: JsonObject;
  resolvedConfig: JsonObject;
  configSchema: string;
  runtimeFingerprint: JsonObject;
}

export interface AssessmentManifest {
  inputHash: Sha256;
  outputHash: Sha256;
  oracleHash: Sha256;
  evidenceReaderHash: Sha256;
  scorerHash: Sha256;
  metricSchema: JsonObject;
  tokenizer: { artifactHash: Sha256; config: JsonObject } | null;
}

function validate(
  value: unknown, hashes: readonly string[], objects: readonly string[], text: readonly string[] = [],
): asserts value is JsonObject {
  assertFields(value, [...hashes, ...objects, ...text]);
  hashes.forEach(key => assertSha256(value[key]));
  objects.forEach(key => assertObject(value[key]));
  text.forEach(key => assertText(value[key]));
}

export function fixtureBuildKey(manifest: FixtureBuildManifest): Sha256 {
  validate(manifest, ["lockfileHash"], ["dependencyClosure", "buildConfig", "toolchain", "environment"]);
  for (const [path, hash] of Object.entries(manifest.dependencyClosure)) {
    assertText(path);
    assertSha256(hash);
  }
  for (const value of Object.values(manifest.environment)) {
    if (typeof value !== "string") throw new TypeError("Environment values must be strings");
  }
  return hashManifest("perception-bench.fixture-build", 1, manifest);
}

export function captureKey(manifest: CaptureManifest): Sha256 {
  assertFields(manifest, [
    "implementationHash", "fixtureArtifactHash", "pageId", "stateRecipe", "seed", "captureCodeHash",
    "validationContractHash", "acquisitionPolicy", "browserRevision", "rendering",
  ]);
  [manifest.implementationHash, manifest.fixtureArtifactHash, manifest.captureCodeHash, manifest.validationContractHash].forEach(assertSha256);
  [manifest.pageId, manifest.browserRevision].forEach(assertText);
  [manifest.stateRecipe, manifest.acquisitionPolicy].forEach(assertObject);
  assertFields(manifest.rendering, ["viewport", "locale", "timeZone", "clock", "settings"]);
  assertFields(manifest.rendering.viewport, ["width", "height"]);
  for (const size of [manifest.rendering.viewport.width, manifest.rendering.viewport.height]) {
    if (!Number.isSafeInteger(size) || size <= 0) throw new TypeError("Viewport sizes must be positive integers");
  }
  [manifest.rendering.locale, manifest.rendering.timeZone, manifest.rendering.clock].forEach(assertText);
  assertObject(manifest.rendering.settings);
  return hashManifest("perception-bench.capture", 2, manifest);
}

export function configKey(configSchema: string, resolvedConfig: JsonObject): Sha256 {
  assertText(configSchema);
  assertObject(resolvedConfig);
  return hashManifest("perception-bench.config", 1, { configSchema, resolvedConfig });
}

export function transformKey(manifest: TransformManifest): Sha256 {
  validate(manifest,
    ["inputHash", "subjectArtifactHash", "runtimeDependenciesHash", "subjectAdapterHash"],
    ["requestedConfig", "resolvedConfig", "runtimeFingerprint"], ["configSchema"]);
  return hashManifest("perception-bench.transform", 1, {
    ...manifest, resolvedConfigHash: configKey(manifest.configSchema, manifest.resolvedConfig),
  });
}

export function assessmentKey(manifest: AssessmentManifest): Sha256 {
  assertFields(manifest, [
    "inputHash", "outputHash", "oracleHash", "evidenceReaderHash", "scorerHash", "metricSchema", "tokenizer",
  ]);
  [manifest.inputHash, manifest.outputHash, manifest.oracleHash, manifest.evidenceReaderHash, manifest.scorerHash]
    .forEach(assertSha256);
  assertObject(manifest.metricSchema);
  if (manifest.tokenizer !== null) {
    validate(manifest.tokenizer, ["artifactHash"], ["config"]);
  }
  return hashManifest("perception-bench.assessment", 1, manifest);
}

export type ComparisonMode = "code" | "config" | "grid";
export interface ComparisonAxes {
  /** Case, stack and presentation-variant identity; fixed even if two outputs happen to match. */
  implementationHash: Sha256;
  corpusHash: Sha256;
  inputHash: Sha256;
  stateHash: Sha256;
  acquisitionHash: Sha256;
  runtimeHash: Sha256;
  /** Hash of executable plus its runtime dependency closure, not a ref or commit label. */
  subjectHash: Sha256;
  subjectAdapterHash: Sha256;
  configHash: Sha256;
  configSchema: string;
  oracleHash: Sha256;
  evidenceReaderHash: Sha256;
  scorerHash: Sha256;
  metricHash: Sha256;
  tokenizerHash: Sha256 | null;
}
const axesFields = [
  "implementationHash", "corpusHash", "inputHash", "stateHash", "acquisitionHash", "runtimeHash", "subjectHash",
  "subjectAdapterHash", "configHash", "configSchema", "oracleHash", "evidenceReaderHash",
  "scorerHash", "metricHash", "tokenizerHash",
] as const;

export function changingAxes(mode: ComparisonMode): readonly ("subjectHash" | "configHash")[] {
  switch (mode) {
    case "code": return ["subjectHash"];
    case "config": return ["configHash"];
    case "grid": return ["subjectHash", "configHash"];
    default: throw new TypeError("Unknown comparison mode");
  }
}

function fixedAxes(mode: ComparisonMode, axes: ComparisonAxes): JsonObject {
  const excluded: readonly string[] = changingAxes(mode);
  assertFields(axes, axesFields);
  const fixed: JsonObject = {};
  for (const key of axesFields) {
    const value = axes[key];
    if (key === "configSchema") assertText(value);
    else if (key !== "tokenizerHash" || value !== null) assertSha256(value);
    if (!excluded.includes(key)) fixed[key] = value;
  }
  return fixed;
}

export function pairingKey(mode: ComparisonMode, axes: ComparisonAxes): Sha256 {
  return hashManifest("perception-bench.pairing", 2, { mode, fixed: fixedAxes(mode, axes) });
}

export class ComparisonMismatchError extends Error {
  readonly mismatchedAxes: string[];
  constructor(axes: string[]) {
    super(`Incompatible comparison axes: ${axes.join(", ")}`);
    this.name = "ComparisonMismatchError";
    this.mismatchedAxes = axes;
  }
}

export function assertCompatibleComparison(mode: ComparisonMode, left: ComparisonAxes, right: ComparisonAxes): void {
  const a = fixedAxes(mode, left);
  const b = fixedAxes(mode, right);
  const mismatches = Object.keys(a).filter(key => a[key] !== b[key]);
  if (mismatches.length) throw new ComparisonMismatchError(mismatches);
}

export interface ComparisonResult { resultKey: Sha256; axes: ComparisonAxes }
export interface PairingReport {
  pairs: { left: ComparisonResult; right: ComparisonResult }[];
  unmatched: { side: "left" | "right"; result: ComparisonResult; reason: string }[];
  matched: number;
  /** Expected baseline cases; unmatched right-side cases are also always reported. */
  expected: number;
  expectedRight: number;
}

/** Compare two selected arms/cells. Duplicate fixed-axis cases in either arm are ambiguous and rejected. */
export function pairResults(
  mode: ComparisonMode, left: readonly ComparisonResult[], right: readonly ComparisonResult[],
): PairingReport {
  changingAxes(mode);
  const index = (results: readonly ComparisonResult[]) => {
    const map = new Map<Sha256, ComparisonResult>();
    for (const result of results) {
      assertFields(result, ["resultKey", "axes"]);
      assertSha256(result.resultKey);
      const key = pairingKey(mode, result.axes);
      if (map.has(key)) throw new Error("Ambiguous duplicate fixed-axis case in comparison arm");
      map.set(key, result);
    }
    return map;
  };
  const a = index(left);
  const b = index(right);
  const report: PairingReport = { pairs: [], unmatched: [], matched: 0, expected: left.length, expectedRight: right.length };
  for (const [key, result] of a) {
    const match = b.get(key);
    if (match) report.pairs.push({ left: result, right: match });
    else report.unmatched.push({ side: "left", result, reason: "No case with identical fixed axes in right arm" });
  }
  for (const [key, result] of b) {
    if (!a.has(key)) report.unmatched.push({ side: "right", result, reason: "No case with identical fixed axes in left arm" });
  }
  report.matched = report.pairs.length;
  return report;
}

export interface ComparisonManifest {
  resultKeys: Sha256[];
  mode: ComparisonMode;
  reportImplementationHash: Sha256;
  reportSchema: string;
}
export function comparisonKey(manifest: ComparisonManifest): Sha256 {
  assertFields(manifest, ["resultKeys", "mode", "reportImplementationHash", "reportSchema"]);
  if (!Array.isArray(manifest.resultKeys)) throw new TypeError("Expected result identity array");
  manifest.resultKeys.forEach(assertSha256);
  if (new Set(manifest.resultKeys).size !== manifest.resultKeys.length) throw new TypeError("Duplicate result identity");
  assertSha256(manifest.reportImplementationHash);
  assertText(manifest.reportSchema);
  return hashManifest("perception-bench.comparison", 1, {
    ...manifest, resultKeys: [...manifest.resultKeys].sort(), changingAxes: changingAxes(manifest.mode),
  });
}
