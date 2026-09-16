import { cases, matrix, stacks } from "./matrix.ts";

console.table(cases.map(uxCase => ({
  case: uxCase.id,
  states: uxCase.states.length,
  ...Object.fromEntries(stacks.map(stack => [
    stack.id,
    matrix.filter(cell => cell.caseId === uxCase.id && cell.stackId === stack.id)
      .map(cell => `${cell.variantId}: ${cell.status}`).join(", ") || "missing",
  ])),
})));

console.log(`${matrix.length} planned implementation variants; ${matrix.reduce((total, cell) => total + cell.stateIds.length, 0)} state cases.`);
console.log("Planned cells have no fixture app or capture adapter yet; registered does not imply validated.");
