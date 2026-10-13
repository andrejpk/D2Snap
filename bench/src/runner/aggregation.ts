import type { ViewerData, ViewerResult } from "./viewer-model.ts";
import { cellId } from "./cell-id.ts";
import { compareProfiles } from "./presentation-order.ts";

export interface AggregateSample {
  cell: ViewerData;
  result: ViewerResult;
}

export interface AggregateStats {
  samples: number;
  cells: number;
  retainedGoals: number;
  requiredGoals: number;
  meanRetention: number | null;
  meanSemantic: number | null;
  fullFidelity: number;
  meanBytes: number;
  meanRawRatio: number | null;
}

export interface AggregateRow {
  key: string;
  label: string;
  profileId?: string;
  samples: AggregateSample[];
  stats: AggregateStats;
}

export function aggregateStats(samples: readonly AggregateSample[]): AggregateStats {
  const mean = (values: (number | null)[]) => {
    const defined = values.filter((value): value is number => value !== null);
    return defined.length ? defined.reduce((sum, value) => sum + value, 0) / defined.length : null;
  };
  return {
    samples: samples.length,
    cells: new Set(samples.map(sample => cellId(sample.cell.report))).size,
    retainedGoals: samples.reduce((sum, { result }) => sum + result.assessment.retention.overall.numerator, 0),
    requiredGoals: samples.reduce((sum, { result }) => sum + result.assessment.retention.overall.denominator, 0),
    meanRetention: mean(samples.map(({ result }) => result.assessment.retention.overall.fraction)),
    meanSemantic: mean(samples.map(({ result }) => result.assessment.semanticRetention.overall.fraction)),
    fullFidelity: samples.filter(({ result }) => result.assessment.fullFidelity).length,
    meanBytes: mean(samples.map(({ result }) => result.assessment.outputBytes)) ?? 0,
    meanRawRatio: mean(samples.map(({ result }) => result.assessment.sizeRatio)),
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function aggregateResults(cells: readonly ViewerData[], by: "config" | "stack"): AggregateRow[] {
  const groups = new Map<string, AggregateRow>();
  for (const cell of cells) for (const result of cell.results) {
    if (by === "stack" && !result.configuration) continue;
    // Identical names with different effective configurations must not be silently pooled.
    const key = by === "stack" ? cell.report.stackId : `${result.profileId}:${stable(result.configuration)}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key, label: by === "stack" ? cell.report.stackId : result.profileId,
        ...(by === "config" ? { profileId: result.profileId } : {}),
        samples: [], stats: aggregateStats([]),
      };
      groups.set(key, group);
    }
    group.samples.push({ cell, result });
  }
  const rows = [...groups.values()];
  for (const row of rows) row.stats = aggregateStats(row.samples);
  return by === "config" ? rows.sort((a, b) => compareProfiles(a.profileId!, b.profileId!)) : rows;
}

export function aggregateCells(samples: readonly AggregateSample[]): AggregateRow[] {
  const groups = new Map<string, AggregateRow>();
  for (const sample of samples) {
    const key = cellId(sample.cell.report);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: sample.cell.report.stackId, samples: [], stats: aggregateStats([]) };
      groups.set(key, group);
    }
    group.samples.push(sample);
  }
  for (const group of groups.values()) group.stats = aggregateStats(group.samples);
  return [...groups.values()];
}
