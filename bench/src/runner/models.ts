import { z } from "zod";
import { caseSchema, idSchema } from "../contracts.ts";
import type { UxCase } from "../contracts.ts";
import type { Assessment } from "../evidence/index.ts";
import { READER_VERSION } from "../evidence/index.ts";

const ratio = z.number().finite().min(0).max(1);
const profileIdSchema = z.union([idSchema, z.string().regex(/^(?:1\.0|0\.[1-9])$/)]);
export const optionsSchema = z.object({
  attributeScoring: z.record(ratio),
  attributeScoringFallback: ratio,
  debug: z.literal(false),
  filterDataURLs: z.boolean(),
  filterEmptyElements: z.boolean(),
  filteredTagNames: z.array(z.string().min(1)),
  liftImageDescription: z.boolean(),
  skipMarkdown: z.boolean(),
  skipTextRank: z.boolean(),
  textRankOptions: z.object({
    damping: ratio,
    maxIterations: z.number().int().positive(),
    minSimilarity: ratio,
    tolerance: z.number().positive().finite(),
  }).strict(),
  uniqueIDs: z.literal(false),
}).strict();
export const planSchema = z.object({
  schemaVersion: z.literal(1),
  options: optionsSchema,
  profiles: z.array(z.object({ id: profileIdSchema, rE: ratio, rA: ratio, rT: ratio }).strict()).min(1),
}).strict().superRefine((plan, context) => {
  const ids = plan.profiles.map(profile => profile.id);
  if (new Set(ids).size !== ids.length || ids.includes("raw")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Profile IDs must be unique and cannot be raw." });
  }
  for (const [index, profile] of plan.profiles.entries()) {
    if (/^(?:1\.0|0\.[1-9])$/.test(profile.id)
      && [profile.rE, profile.rA, profile.rT].some(value => value !== Number(profile.id))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["profiles", index],
        message: "Numeric profiles must set rE, rA and rT to their named reduction level." });
    }
  }
});
export type Plan = z.infer<typeof planSchema>;
export type Configuration = Plan["profiles"][number] & { options: Plan["options"] };
export const filesSchema = z.record(z.string().min(1), z.string());
export const captureSchema = z.object({ html: z.string(), screenshot: z.string() }).strict();
export type Capture = z.infer<typeof captureSchema>;

const checkSchema = z.object({ code: z.string(), passed: z.boolean(), message: z.string(), inference: z.string().optional() });
const retentionSchema = z.object({
  numerator: z.number().int().nonnegative(), denominator: z.number().int().nonnegative(),
  fraction: ratio.nullable(),
});
export const assessmentSchema = z.object({
  reader: z.object({
    version: z.literal(READER_VERSION), format: z.enum(["html", "html-markdown"]),
    status: z.enum(["ok", "unsupported"]), reasons: z.array(z.string()),
  }),
  requirements: z.array(z.object({
    id: z.string(), category: z.enum(["content", "control"]), passed: z.boolean(),
    verdict: z.enum(["pass", "fail"]), reasons: z.array(z.string()), checks: z.array(checkSchema),
    alternatives: z.array(z.object({ id: z.string(), passed: z.boolean(), checks: z.array(checkSchema) })),
    matchedAlternatives: z.array(z.string()),
    semanticPassed: z.boolean(), match: z.enum(["explicit", "inferred", "none"]), inferenceRules: z.array(z.string()),
  })),
  retention: z.object({ content: retentionSchema, control: retentionSchema, overall: retentionSchema }),
  semanticRetention: z.object({ content: retentionSchema, control: retentionSchema, overall: retentionSchema }),
  fullFidelity: z.boolean(),
  inputBytes: z.number().nonnegative(), outputBytes: z.number().nonnegative(),
  outputKB: z.number().nonnegative(), sizeRatio: z.number().nonnegative().nullable(),
  sizeRatioStatus: z.enum(["defined", "zero-input"]),
}) satisfies z.ZodType<Assessment>;

export interface Counts {
  fixtureBuilds: number;
  subjectBuilds: number;
  browserLaunches: number;
  captures: number;
  transforms: number;
  assessments: number;
}
export interface DemoResult {
  stateId: string;
  profileId: string;
  configuration: Configuration | null;
  assessment: Assessment;
  output: string;
  captureKey: string;
  transformKey: string | null;
  assessmentKey: string;
  cache: { capture: string; transform: string; assessment: string };
}
export interface DemoReport {
  schemaVersion: 1;
  caseDefinition: UxCase;
  generatedAt: string;
  caseId: string;
  stackId: string;
  variantId: string;
  subject: { label: string; hash: string };
  fixtureHash: string;
  browser: Record<string, string>;
  counts: Counts;
  captures: Record<string, Capture>;
  results: DemoResult[];
}

export interface SuiteReport {
  schemaVersion: 1;
  kind: "matrix";
  generatedAt: string;
  reports: DemoReport[];
}
const count = z.number().int().nonnegative();
export const reportSchema = z.object({
  schemaVersion: z.literal(1),
  caseDefinition: caseSchema,
  generatedAt: z.string().datetime(),
  caseId: idSchema, stackId: idSchema, variantId: idSchema,
  subject: z.object({ label: z.string(), hash: z.string() }),
  fixtureHash: z.string(), browser: z.record(z.string()),
  counts: z.object({
    fixtureBuilds: count, subjectBuilds: count, browserLaunches: count,
    captures: count, transforms: count, assessments: count,
  }),
  captures: z.record(captureSchema),
  results: z.array(z.object({
    stateId: idSchema, profileId: profileIdSchema,
    configuration: z.object({
      id: profileIdSchema, rE: ratio, rA: ratio, rT: ratio, options: optionsSchema,
    }).nullable(),
    assessment: assessmentSchema, output: z.string(),
    captureKey: z.string(), transformKey: z.string().nullable(), assessmentKey: z.string(),
    cache: z.object({ capture: z.string(), transform: z.string(), assessment: z.string() }),
  })),
}) satisfies z.ZodType<DemoReport>;

export const suiteReportSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("matrix"), generatedAt: z.string().datetime(),
  reports: z.array(reportSchema).min(1),
}).superRefine((suite, context) => {
  const keys = suite.reports.map(report => `${report.stackId}/${report.caseId}/${report.variantId}`);
  if (new Set(keys).size !== keys.length) context.addIssue({
    code: z.ZodIssueCode.custom, message: "Matrix reports require unique case/stack/variant identities.",
  });
}) satisfies z.ZodType<SuiteReport>;
