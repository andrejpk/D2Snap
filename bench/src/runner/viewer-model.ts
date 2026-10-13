import type { Assessment } from "../evidence/index.ts";
import type { Configuration, DemoReport } from "./models.ts";

export interface Highlight {
  selectors: string[];
  kind: "match" | "context" | "none";
  explanation: string;
}

export interface Preview {
  document: string;
  highlights: Record<string, Highlight>;
  sourceHighlights: Record<string, SourceHighlight>;
}

export interface SourceRange { from: number; to: number }

export interface SourceHighlight {
  ranges: SourceRange[];
  kind: Highlight["kind"];
  provenance: "explicit" | "inferred" | "none";
  explanation: string;
}

export interface ViewerGoal {
  id: string;
  description: string;
  category: "content" | "control";
  passed: boolean;
  matchedAlternatives: string[];
  reasons: string[];
  match: "explicit" | "inferred" | "none";
  semanticPassed: boolean;
  inferenceRules: string[];
}

export interface ViewerState {
  id: string;
  description: string;
  raw: string;
  rawBytes: number;
  screenshot: string;
  preview: Preview;
}

export interface ViewerResult {
  id: string;
  stateId: string;
  profileId: string;
  output: string;
  configuration: Configuration | null;
  assessment: Assessment;
  goals: ViewerGoal[];
  preview: Preview;
}

export interface ViewerData {
  schemaVersion: 1;
  report: DemoReport;
  states: ViewerState[];
  results: ViewerResult[];
}

export interface ViewerSuite {
  schemaVersion: 1;
  kind: "matrix";
  generatedAt: string;
  cells: ViewerData[];
}
