export function compareProfiles(left: string, right: string): number {
  const rank = (id: string) => id === "raw" ? -1 : /^(?:1\.0|0\.[1-9])$/.test(id) ? Number(id) : Infinity;
  const a = rank(left), b = rank(right);
  return a === b ? 0 : a - b;
}

export function presentationOrder<T extends { stateId: string; profileId: string }>(results: readonly T[]): T[] {
  const states = new Map([...new Set(results.map(result => result.stateId))].map((id, index) => [id, index]));
  return [...results].sort((left, right) =>
    states.get(left.stateId)! - states.get(right.stateId)! || compareProfiles(left.profileId, right.profileId));
}
