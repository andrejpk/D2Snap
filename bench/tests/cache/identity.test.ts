import assert from "node:assert/strict";
import test from "node:test";
import {
  assessmentKey, assertCompatibleComparison, assertSha256, canonicalJson, captureKey,
  changingAxes, comparisonKey, ComparisonMismatchError, configKey, fixtureBuildKey,
  hashManifest, implementationKey, pairingKey, pairResults, sha256, transformKey,
} from "../../src/cache/index.ts";
import type {
  AssessmentManifest, CaptureManifest, ComparisonAxes, FixtureBuildManifest, TransformManifest,
} from "../../src/cache/index.ts";

const hash = sha256("fixture");
const other = sha256("different");
const build: FixtureBuildManifest = {
  dependencyClosure: { "src/page.ts": hash, "assets/font.woff": hash, "src/untracked.ts": hash },
  lockfileHash: hash, buildConfig: { minify: true }, toolchain: { node: "24.14.0" }, environment: { MODE: "production" },
};
const capture: CaptureManifest = {
  implementationHash: hash,
  fixtureArtifactHash: hash, pageId: "form", stateRecipe: { fill: ["name", "Ada"] },
  seed: 42, captureCodeHash: hash, validationContractHash: hash,
  acquisitionPolicy: { formState: "mirror-live-properties" }, browserRevision: "chromium-123",
  rendering: { viewport: { width: 1280, height: 720 }, locale: "en-US", timeZone: "UTC", clock: "2026-01-01", settings: { colorScheme: "light" } },
};
const transform: TransformManifest = {
  inputHash: hash, subjectArtifactHash: hash, runtimeDependenciesHash: hash, subjectAdapterHash: hash,
  requestedConfig: { rE: 0.5 }, resolvedConfig: { rE: 0.5, rA: 0.5, rT: 0.5, attributeScores: { fallback: 0.1 }, filter: true },
  configSchema: "d2snap-1", runtimeFingerprint: { node: "24.14.0", protocol: "capture/replay-1" },
};
const assessment: AssessmentManifest = {
  inputHash: hash, outputHash: hash, oracleHash: hash, evidenceReaderHash: hash, scorerHash: hash,
  metricSchema: { version: 1, size: "utf8-bytes" }, tokenizer: null,
};
const axes: ComparisonAxes = {
  implementationHash: hash,
  corpusHash: hash, inputHash: hash, stateHash: hash, acquisitionHash: hash, runtimeHash: hash,
  subjectHash: hash, subjectAdapterHash: hash,
  configHash: configKey(transform.configSchema, transform.resolvedConfig), configSchema: transform.configSchema,
  oracleHash: hash, evidenceReaderHash: hash, scorerHash: hash, metricHash: hash, tokenizerHash: null,
};

test("canonical JSON recursively sorts keys, preserves arrays and exact strings, and permits shared subobjects", () => {
  assert.equal(canonicalJson({ z: [3, { y: 1, a: 2 }], a: "x\r\n" }), '{"a":"x\\r\\n","z":[3,{"a":2,"y":1}]}');
  assert.equal(canonicalJson({ "2": 2, "10": 10 }), '{"10":10,"2":2}');
  assert.equal(canonicalJson(-0), "0");
  const shared = { z: 1 };
  assert.equal(canonicalJson([shared, shared]), '[{"z":1},{"z":1}]');
  assert.equal(canonicalJson(Object.assign(Object.create(null), { b: 1 })), '{"b":1}');
  assert.notEqual(sha256(canonicalJson([1, 2])), sha256(canonicalJson([2, 1])));
  assert.notEqual(sha256("é"), sha256("e\u0301"));
});

test("canonical JSON rejects all unsupported data without invoking getters", () => {
  let getterCalled = false;
  const cycle: unknown[] = [];
  cycle.push(cycle);
  const accessor = { get x() { getterCalled = true; return 1; } };
  const extra = Object.assign([1], { extra: 2 });
  const maskedHole = Object.assign(new Array(1), { extra: 1 });
  for (const invalid of [
    undefined, { x: undefined }, [undefined], new Array(1), maskedHole, NaN, Infinity, -Infinity,
    new Date(), new Map(), new Set(), /x/, 1n, () => 1, Symbol("x"), cycle, accessor, extra,
    Object.assign({}, { [Symbol("x")]: 1 }), Object.defineProperty({}, "hidden", { value: 1 }),
    Object.create({ inherited: 1 }), new Uint8Array([1]), new (class extends Array {})(),
  ]) assert.throws(() => canonicalJson(invalid), TypeError);
  assert.equal(getterCalled, false);
});

test("SHA-256 and manifests separate domains/schema and reject invalid identities", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256("abc"), sha256(Buffer.from("abc")));
  assert.notEqual(hashManifest("build", 1, {}), hashManifest("capture", 1, {}));
  assert.notEqual(hashManifest("build", 1, {}), hashManifest("build", 2, {}));
  assert.equal(hashManifest("build", 1, { b: 1, a: 2 }), hashManifest("build", 1, { a: 2, b: 1 }));
  for (const bad of ["", "../x", hash.toUpperCase(), `${hash}/../x`, "x".repeat(64), null, 1]) {
    assert.throws(() => assertSha256(bad), TypeError);
  }
  for (const schema of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => hashManifest("build", schema, {}));
  assert.throws(() => hashManifest("build\n", 1, {}));
});

test("pipeline config/subject/oracle changes invalidate only their dependent stages", () => {
  const buildBefore = fixtureBuildKey(build);
  const captureBefore = captureKey(capture);
  const transformBefore = transformKey(transform);
  const assessmentBefore = assessmentKey(assessment);
  for (const change of [
    { subjectArtifactHash: other }, { runtimeDependenciesHash: other }, { subjectAdapterHash: other },
    { resolvedConfig: { ...transform.resolvedConfig, filter: false } }, { runtimeFingerprint: { protocol: "new" } },
    { inputHash: other }, { configSchema: "new" },
  ]) assert.notEqual(transformKey({ ...transform, ...change }), transformBefore);
  assert.equal(fixtureBuildKey(build), buildBefore);
  assert.equal(captureKey(capture), captureBefore);
  for (const change of [
    { oracleHash: other }, { evidenceReaderHash: other }, { scorerHash: other }, { outputHash: other },
    { metricSchema: { version: 2 } }, { tokenizer: { artifactHash: other, config: {} } },
  ]) assert.notEqual(assessmentKey({ ...assessment, ...change }), assessmentBefore);
  assert.equal(transformKey(transform), transformBefore);
  assert.notEqual(captureKey({ ...capture, validationContractHash: other }), captureBefore);
  assert.notEqual(captureKey({ ...capture, stateRecipe: { fill: ["name", "Grace"] } }), captureBefore);
  assert.notEqual(captureKey({ ...capture, rendering: { ...capture.rendering, settings: { colorScheme: "dark" } } }), captureBefore);
  assert.notEqual(fixtureBuildKey({ ...build, dependencyClosure: { ...build.dependencyClosure, "assets/font.woff": other } }), buildBefore);
  assert.notEqual(fixtureBuildKey({ ...build, lockfileHash: other }), buildBefore);
  assert.equal(transformKey({ ...transform }), transformBefore, "provenance labels live outside manifests");
  assert.throws(() => transformKey({ ...transform, branch: "renamed" } as never), TypeError);
});

test("pipeline manifests are runtime validated, not merely TypeScript-typed", () => {
  assert.throws(() => fixtureBuildKey({ ...build, dependencyClosure: { x: "HEAD" } } as never));
  assert.throws(() => fixtureBuildKey({ ...build, environment: { MODE: 1 } } as never));
  assert.throws(() => captureKey({ ...capture, seed: undefined } as never));
  assert.throws(() => captureKey({ ...capture, rendering: { ...capture.rendering, viewport: { width: 0, height: 1 } } }));
  assert.throws(() => transformKey({ ...transform, resolvedConfig: null } as never));
  assert.throws(() => transformKey({ ...transform, subjectArtifactHash: "main" } as never));
  assert.throws(() => assessmentKey({ ...assessment, tokenizer: {} } as never));
  assert.throws(() => configKey("", {}));
});

test("presentation identity invalidates capture and pairing even for identical DOM output", () => {
  const implementation = {
    caseId: "records", stackId: "react-shadcn", variantId: "icon-toolbar",
    presentation: { actions: "icons", placement: "toolbar" },
  };
  const identity = implementationKey(implementation);
  for (const edit of [
    { caseId: "request-detail" }, { stackId: "angular-primeng" }, { variantId: "text-actions" },
    { presentation: { actions: "text", placement: "inline" } },
  ]) assert.notEqual(identity, implementationKey({ ...implementation, ...edit }));
  assert.equal(identity, implementationKey({
    ...implementation, presentation: { placement: "toolbar", actions: "icons" },
  }));
  assert.notEqual(captureKey(capture), captureKey({ ...capture, implementationHash: other }));
  for (const mode of ["code", "config", "grid"] as const) {
    assert.throws(() => assertCompatibleComparison(mode, axes, { ...axes, implementationHash: other }),
      (error: unknown) => error instanceof ComparisonMismatchError && error.mismatchedAxes.includes("implementationHash"));
  }
  assert.equal(transformKey(transform), transformKey({ ...transform }),
    "identical input bytes and subject/config may still reuse the transform across captures");
});

test("comparison modes exclude exactly the intended axes and retain config compatibility", () => {
  const code = { ...axes, subjectHash: other };
  const config = { ...axes, configHash: other };
  const grid = { ...code, configHash: other };
  assertCompatibleComparison("code", axes, code);
  assertCompatibleComparison("config", axes, config);
  assertCompatibleComparison("grid", axes, grid);
  assert.equal(pairingKey("code", axes), pairingKey("code", code));
  assert.equal(pairingKey("config", axes), pairingKey("config", config));
  assert.equal(pairingKey("grid", axes), pairingKey("grid", grid));
  assert.throws(() => assertCompatibleComparison("code", axes, config), ComparisonMismatchError);
  assert.throws(() => assertCompatibleComparison("config", axes, code), ComparisonMismatchError);
  for (const key of Object.keys(axes) as (keyof ComparisonAxes)[]) {
    if (key === "subjectHash" || key === "configHash") continue;
    const changed = { ...axes, [key]: key === "configSchema" ? "incompatible" : other };
    assert.throws(() => assertCompatibleComparison("grid", axes, changed), (error: unknown) =>
      error instanceof ComparisonMismatchError && error.mismatchedAxes.includes(key));
  }
  assert.throws(() => pairingKey("unknown" as never, axes));
  assert.throws(() => pairingKey("code", { ...axes, subjectHash: "main" } as never));
  assert.deepEqual(changingAxes("grid"), ["subjectHash", "configHash"]);
});

test("pairing reports counts and both unmatched sides without averaging incompatible cases", () => {
  const left = [{ resultKey: hash, axes }, { resultKey: other, axes: { ...axes, inputHash: other } }];
  const right = [{ resultKey: other, axes: { ...axes, subjectHash: other } },
    { resultKey: hash, axes: { ...axes, oracleHash: other } }];
  const report = pairResults("code", left, right);
  assert.equal(report.matched, 1);
  assert.equal(report.expected, 2);
  assert.equal(report.expectedRight, 2);
  assert.deepEqual(report.unmatched.map(item => item.side), ["left", "right"]);
  assert.ok(report.unmatched.every(item => item.reason.length > 0));
  assert.throws(() => pairResults("code", [left[0]!, left[0]!], []), /Ambiguous/);
  assert.throws(() => pairResults("invalid" as never, [], []));
});

test("comparison identity sorts selected results and separates report implementations and modes", () => {
  const manifest = { resultKeys: [hash, other], mode: "code" as const, reportImplementationHash: hash, reportSchema: "1" };
  assert.equal(comparisonKey(manifest), comparisonKey({ ...manifest, resultKeys: [other, hash] }));
  assert.notEqual(comparisonKey(manifest), comparisonKey({ ...manifest, mode: "grid" }));
  assert.notEqual(comparisonKey(manifest), comparisonKey({ ...manifest, reportImplementationHash: other }));
  assert.throws(() => comparisonKey({ ...manifest, resultKeys: [hash, hash] }));
});
