export function cellId(cell: { stackId: string; caseId: string; variantId: string }): string {
  return `${cell.stackId}.${cell.caseId}.${cell.variantId}`;
}
