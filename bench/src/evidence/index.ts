import { Buffer } from "node:buffer";
import { JSDOM } from "jsdom";
import { computeAccessibleDescription, computeAccessibleName, getRole } from "dom-accessibility-api";
import { marked } from "marked";
import { stateSchema } from "../contracts.ts";
import type { CaseState, EvidenceRule, Requirement, Scope } from "../contracts.ts";

export const READER_VERSION = "html-markdown-v3";
export type OutputFormat = "html" | "html-markdown";
export const READER_LIMITS = { outputBytes: 1_000_000, elements: 20_000, depth: 128 } as const;

export interface Check {
  code: string;
  passed: boolean;
  message: string;
}

export interface RequirementAssessment {
  id: string;
  category: Requirement["category"];
  verdict: "pass" | "fail";
  passed: boolean;
  reasons: string[];
  checks: Check[];
  alternatives: AlternativeAssessment[];
  matchedAlternatives: string[];
}

export interface AlternativeAssessment {
  id: string;
  passed: boolean;
  checks: Check[];
}

export interface Retention {
  numerator: number;
  denominator: number;
  /** null means N/A, not zero retention. */
  fraction: number | null;
}

export interface Assessment {
  reader: { version: typeof READER_VERSION; format: OutputFormat; status: "ok" | "unsupported"; reasons: string[] };
  requirements: RequirementAssessment[];
  retention: { content: Retention; control: Retention; overall: Retention };
  fullFidelity: boolean;
  inputBytes: number;
  outputBytes: number;
  outputKB: number;
  sizeRatio: number | null;
  sizeRatioStatus: "defined" | "zero-input";
}

type Control = Extract<EvidenceRule, { kind: "control" }>;
type StateName = keyof NonNullable<Control["states"]>;
const normalize = (text: string): string => text.replace(/\s+/gu, " ").trim();
const check = (code: string, passed: boolean, message: string): Check => ({ code, passed, message });
const role = (element: Element): string | null => getRole(element);
const name = (element: Element): string =>
  normalize(computeAccessibleName(element, { computedStyleSupportsPseudoElements: false }));
const all = (root: Element): Element[] => [root, ...root.querySelectorAll("*")];
const rowRoles = new Set(["row"]);
const tableRoles = new Set(["table", "grid", "treegrid"]);
const cellRoles = new Set(["cell", "gridcell", "columnheader", "rowheader"]);
const nonEvidence = "script,style,template,noscript,iframe,object,embed,svg,canvas";
const blockTags = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "CAPTION", "DD", "DIV", "DL", "DT",
  "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5",
  "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE",
  "TBODY", "TD", "TH", "THEAD", "TR", "UL",
]);

/** Scores only delivered output; input is never parsed or searched. Invalid contracts throw. */
export function assessOutput(
  output: string,
  state: CaseState,
  input: string,
  format: OutputFormat = "html-markdown",
): Assessment {
  if (format !== "html" && format !== "html-markdown") {
    throw new TypeError(`Unsupported output format: ${String(format)}`);
  }
  const contract = stateSchema.parse(state);
  const outputBytes = Buffer.byteLength(output, "utf8");
  const inputBytes = Buffer.byteLength(input, "utf8");
  let dom: JSDOM | undefined;
  let readerError: string | undefined;
  let requirements: RequirementAssessment[];
  try {
    if (outputBytes > READER_LIMITS.outputBytes) throw new Error("Output exceeds reader byte limit.");
    // No scripts, resource loading, browser navigation, or execution of event handlers.
    dom = new JSDOM(format === "html" ? output : marked.parse(output, { async: false, gfm: true }));
    prepareDocument(dom.window.document);
    requirements = contract.requirements.map(requirement =>
      result(requirement, requirement.evidence.map(alternative => ({
        id: alternative.id,
        checks: alternative.allOf.flatMap(rule => evaluate(rule, dom!.window.document.body)),
      }))));
  } catch (error) {
    readerError = error instanceof Error ? error.message : "Evidence reader failed.";
    requirements = contract.requirements.map(requirement =>
      result(requirement, requirement.evidence.map(alternative => ({
        id: alternative.id,
        checks: [check("reader-unsupported", false, readerError!)],
      }))));
  } finally {
    dom?.window.close();
  }
  const retention = (items: RequirementAssessment[]): Retention => ({
    numerator: items.filter(item => item.passed).length,
    denominator: items.length,
    fraction: items.length ? items.filter(item => item.passed).length / items.length : null,
  });
  return {
    reader: { version: READER_VERSION, format, status: readerError ? "unsupported" : "ok", reasons: readerError ? [readerError] : [] },
    requirements,
    retention: {
      content: retention(requirements.filter(item => item.category === "content")),
      control: retention(requirements.filter(item => item.category === "control")),
      overall: retention(requirements),
    },
    fullFidelity: requirements.length > 0 && requirements.every(item => item.passed),
    inputBytes,
    outputBytes,
    outputKB: outputBytes / 1000,
    sizeRatio: inputBytes ? outputBytes / inputBytes : null,
    sizeRatioStatus: inputBytes ? "defined" : "zero-input",
  };
}

function result(
  requirement: Requirement,
  evidence: { id: string; checks: Check[] }[],
): RequirementAssessment {
  const alternatives = evidence.map(alternative => ({
    ...alternative,
    passed: alternative.checks.length > 0 && alternative.checks.every(item => item.passed),
  }));
  const matchedAlternatives = alternatives.filter(alternative => alternative.passed).map(alternative => alternative.id);
  const passed = matchedAlternatives.length > 0;
  const checks = alternatives.find(alternative => alternative.passed)?.checks
    ?? alternatives.flatMap(alternative => alternative.checks);
  return {
    id: requirement.id, category: requirement.category, passed,
    verdict: passed ? "pass" : "fail",
    reasons: checks.filter(item => !item.passed).map(item => item.message),
    checks,
    alternatives,
    matchedAlternatives,
  };
}

function prepareDocument(document: Document): void {
  const elements = [...document.querySelectorAll("*")];
  if (elements.length > READER_LIMITS.elements) throw new Error("Output exceeds reader element limit.");
  for (const element of elements) {
    let depth = 0;
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) depth++;
    if (depth > READER_LIMITS.depth) throw new Error("Output exceeds reader nesting limit.");
  }
  // Snapshot detectable CSS hiding before removing styles from the evidence/name tree.
  const hidden = elements.filter(element => {
    const style = document.defaultView!.getComputedStyle(element);
    return style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse";
  });
  for (const element of hidden) element.setAttribute("hidden", "");
  for (const element of document.querySelectorAll(nonEvidence)) element.remove();
  const comments = document.createTreeWalker(document, 128);
  const remove: Node[] = [];
  while (comments.nextNode()) remove.push(comments.currentNode);
  for (const comment of remove) comment.parentNode?.removeChild(comment);
  sectionize(document.body);
}

function visible(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute("hidden") || current.hasAttribute("inert")
      || current.getAttribute("aria-hidden")?.toLowerCase() === "true"
      || (current.tagName === "INPUT" && current.getAttribute("type")?.toLowerCase() === "hidden")) return false;
    if (current.tagName === "DETAILS" && !current.hasAttribute("open")) {
      const summary = [...current.children].find(child => child.tagName === "SUMMARY");
      if (current !== element && !summary?.contains(element)) return false;
    }
  }
  return true;
}

/** Markdown/HTML headings delimit sibling sections until the next same-or-higher heading. */
function sectionize(parent: Element): void {
  const parentRole = role(parent);
  if ((parentRole === "region" || parentRole === "dialog") && name(parent)) return;
  const children = [...parent.children];
  for (const child of children) sectionize(child);
  if (!["BODY", "DIV", "MAIN", "ARTICLE", "SECTION"].includes(parent.tagName)) return;
  const stack: { level: number; section: Element }[] = [];
  for (const node of [...parent.childNodes]) {
    const element = node.nodeType === 1 ? node as Element : undefined;
    const level = element && /^H[1-6]$/u.test(element.tagName) ? Number(element.tagName[1]) : undefined;
    if (level && element && visible(element)) {
      while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
      const section = parent.ownerDocument.createElement("section");
      section.setAttribute("aria-label", visibleText(element));
      (stack[stack.length - 1]?.section ?? parent).insertBefore(
        section, stack.length ? null : node,
      );
      section.append(node);
      stack.push({ level, section });
    } else if (stack.length) {
      stack[stack.length - 1]!.section.append(node);
    }
  }
}

function textRuns(root: Element): string[] {
  const runs: string[] = [];
  let current = "";
  const flush = (): void => {
    const text = normalize(current);
    if (text) runs.push(text);
    current = "";
  };
  const walk = (node: Node): void => {
    if (node.nodeType === 3) { current += node.textContent ?? ""; return; }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (!visible(element) || element.matches(nonEvidence)) return;
    const boundary = blockTags.has(element.tagName) || cellRoles.has(role(element) ?? "");
    if (boundary) flush();
    for (const child of element.childNodes) walk(child);
    if (boundary) flush();
  };
  walk(root);
  flush();
  return runs;
}

function visibleText(element: Element): string {
  return normalize(textRuns(element).join(" "));
}

function occurrences(text: string, expected: string): number {
  let count = 0;
  let start = 0;
  for (let index = text.indexOf(expected, start); index !== -1; index = text.indexOf(expected, start)) {
    const before = text.slice(0, index);
    const after = text.slice(index + expected.length);
    // Keep numeric/identifier continuations (1200, PR-120-2, 120.00) from passing as 120.
    const left = /[\p{L}\p{N}\p{M}_]$/u.test(before) || /[\p{L}\p{N}\p{M}_][-.,:/@+]$/u.test(before);
    const right = /^[\p{L}\p{N}\p{M}_]/u.test(after) || /^[-.,:/@+][\p{L}\p{N}\p{M}_]/u.test(after);
    if (!left && !right) count++;
    start = index + Math.max(expected.length, 1);
  }
  return count;
}

function closestRole(element: Element | null, roles: Set<string>): Element | undefined {
  for (let current = element; current; current = current.parentElement) {
    if (roles.has(role(current) ?? "")) return current;
  }
  return undefined;
}

function cells(row: Element): Element[] {
  return [...row.querySelectorAll("*")].filter(element =>
    cellRoles.has(role(element) ?? "") && closestRole(element.parentElement, rowRoles) === row && visible(element));
}

function resolveScope(scope: Scope, root: Element): { element?: Element; checks: Check[] } {
  if (scope.kind === "page") return { element: root, checks: [check("scope", true, "Page scope resolved.")] };
  if (scope.kind === "selection-toolbar") return selectionToolbar(scope.anchor, root);
  if (scope.kind === "controlled-popup") return controlledPopup(scope.anchor, root);
  const candidates = all(root).filter(element => {
    if (!visible(element)) return false;
    if (scope.kind === "row") return role(element) === "row"
      && cells(element).some(cell => visibleText(cell) === normalize(scope.anchor));
    return role(element) === scope.kind && name(element) === normalize(scope.name);
  });
  const unique = candidates.length === 1;
  return {
    ...(unique ? { element: candidates[0]! } : {}),
    checks: [check("scope", unique, unique
      ? `${scope.kind} scope resolved uniquely.`
      : `${scope.kind} scope requires one match; found ${candidates.length}.`),
    ...(unique ? referenceChecks(candidates[0]!) : [])],
  };
}

function controlledPopup(anchor: string, root: Element): { element?: Element; checks: Check[] } {
  const row = resolveScope({ kind: "row", anchor }, root);
  if (!row.element) return row;
  const triggers = all(row.element).filter(element => visible(element)
    && closestRole(element, rowRoles) === row.element
    && element.getAttribute("aria-expanded") === "true");
  const ids = triggers.length === 1
    ? normalize(triggers[0]!.getAttribute("aria-controls") ?? "").split(" ").filter(Boolean)
    : [];
  const targets = ids.length === 1 ? referenced(root.ownerDocument, ids[0]!) : [];
  if (targets.length === 1 && (!visible(targets[0]!) || targets[0]!.contains(row.element))) {
    targets.length = 0;
  }
  const unique = targets.length === 1;
  return {
    ...(unique ? { element: targets[0]! } : {}),
    checks: [...row.checks, check("controlled-popup", unique,
      `The target row must have one expanded trigger linked to a visible popup; found ${targets.length}.`)],
  };
}

function selectionToolbar(anchor: string, root: Element): { element?: Element; checks: Check[] } {
  const rows = all(root).filter(element => visible(element) && role(element) === "row");
  const targets = rows.filter(row => cells(row).some(cell => visibleText(cell) === normalize(anchor)));
  if (targets.length !== 1) {
    return { checks: [check("selection-target", false, "Selection target must identify one visible row.")] };
  }
  const target = targets[0]!;
  const table = closestRole(target.parentElement, tableRoles);
  const selected = rows.filter(row => table && closestRole(row.parentElement, tableRoles) === table
    && row.getAttribute("aria-selected") === "true");
  if (!table || !table.id || referenced(root.ownerDocument, table.id).length !== 1
    || selected.length !== 1 || selected[0] !== target) {
    return { checks: [check("selection-target", false,
      "Target must be the sole explicitly selected row in an identifiable table/grid.")] };
  }
  const candidates = all(root).filter(element => {
    if (!visible(element) || role(element) !== "toolbar") return false;
    const controls = normalize(element.getAttribute("aria-controls") ?? "").split(" ").filter(Boolean);
    return controls.length === 1 && controls[0] === table.id;
  });
  const unique = candidates.length === 1;
  return {
    ...(unique ? { element: candidates[0]! } : {}),
    checks: [
      check("selection-target", true, "The target is the sole explicitly selected row."),
      check("selection-toolbar", unique,
        `One toolbar must explicitly control the selected row's table/grid; found ${candidates.length}.`),
      ...(unique ? referenceChecks(candidates[0]!) : []),
    ],
  };
}

function evaluate(rule: EvidenceRule, root: Element): Check[] {
  const scope = resolveScope(rule.scope, root);
  if (!scope.element) return scope.checks;
  if (rule.kind === "text") {
    const count = textRuns(scope.element).reduce((sum, text) => sum + occurrences(text, normalize(rule.text)), 0);
    return [...scope.checks, check("text", count === 1, `Text ${JSON.stringify(rule.text)} requires one bounded occurrence; found ${count}.`)];
  }
  if (rule.kind === "record") return [...scope.checks, ...recordChecks(scope.element, rule.fields)];
  if (rule.kind === "properties") return [...scope.checks, ...propertyChecks(scope.element, rule.fields)];
  return [...scope.checks, ...controlChecks(scope.element, rule)];
}

function propertyChecks(scope: Element, fields: { label: string; value: string }[]): Check[] {
  const runs = textRuns(scope);
  return fields.map(field => {
    const label = normalize(field.label);
    const values = runs.filter(run => run.startsWith(`${label}:`))
      .map(run => normalize(run.slice(label.length + 1)));
    for (const term of scope.querySelectorAll("dt")) {
      if (!visible(term) || visibleText(term) !== label || term.parentElement?.tagName !== "DL") continue;
      const definition = term.nextElementSibling;
      // A value belongs to exactly one preceding term; grouped/ambiguous definitions do not qualify.
      if (term.previousElementSibling?.tagName === "DT"
        || definition?.tagName !== "DD" || !visible(definition)
        || definition.nextElementSibling?.tagName === "DD") {
        values.push("");
      } else {
        values.push(visibleText(definition));
      }
    }
    return check("property", values.length === 1 && values[0] === normalize(field.value),
      `Property ${JSON.stringify(label)} needs one associated value ${JSON.stringify(field.value)}; observed ${JSON.stringify(values)}.`);
  });
}

function referenced(document: Document, id: string): Element[] {
  // IDs only resolve relationships present in the output, never identify an oracle target.
  return [...document.querySelectorAll("[id]")].filter(element => element.id === id);
}

function referenceChecks(element: Element): Check[] {
  const checks: Check[] = [];
  for (const attribute of ["aria-labelledby", "aria-describedby"]) {
    if (!element.hasAttribute(attribute)) continue;
    const ids = normalize(element.getAttribute(attribute) ?? "").split(" ").filter(Boolean);
    const valid = ids.length > 0 && new Set(ids).size === ids.length
      && ids.every(id => referenced(element.ownerDocument, id).length === 1);
    checks.push(check("relationship", valid, `${attribute} must resolve every reference uniquely within the output.`));
  }
  if (element.id && [...element.ownerDocument.querySelectorAll("label")].some(label => label.htmlFor === element.id)) {
    checks.push(check("relationship", referenced(element.ownerDocument, element.id).length === 1,
      "A label's for relationship must resolve one control."));
  }
  return checks;
}

function controlChecks(scope: Element, rule: Control): Check[] {
  const candidates = all(scope).filter(element =>
    visible(element) && role(element) === rule.role && name(element) === normalize(rule.name));
  const checks = [check("control", candidates.length === 1,
    `Role ${rule.role} with name ${JSON.stringify(rule.name)} requires one visible semantic control; found ${candidates.length}.`)];
  if (candidates.length !== 1) return checks;
  const element = candidates[0]!;
  checks.push(...referenceChecks(element));
  if (rule.value !== undefined) {
    const value = controlValue(element, rule.role);
    checks.push(check("value", value !== undefined && normalize(value) === normalize(rule.value),
      `Expected value ${JSON.stringify(rule.value)}; observed ${value === undefined ? "missing, ambiguous, or contradictory value" : JSON.stringify(value)}.`));
  }
  for (const [key, expected] of Object.entries(rule.states ?? {})) {
    const observed = controlState(element, key as StateName, rule.role);
    checks.push(check(`state-${key}`, observed.value === expected && !observed.error,
      `${key}: expected ${expected}; ${observed.error ?? `observed ${String(observed.value ?? "missing")}`}.`));
  }
  if (rule.description !== undefined) {
    const description = normalize(computeAccessibleDescription(element, { computedStyleSupportsPseudoElements: false }));
    checks.push(check("description", description === normalize(rule.description),
      `Expected accessible description ${JSON.stringify(rule.description)}; observed ${JSON.stringify(description)}.`));
  }
  return checks;
}

function controlValue(element: Element, semanticRole: string): string | undefined {
  const values: string[] = [];
  if (element.tagName === "SELECT") {
    const selected = [...(element as HTMLSelectElement).selectedOptions].filter(visible);
    if (selected.length !== 1) return undefined;
    values.push(visibleText(selected[0]!));
  } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    values.push((element as HTMLInputElement | HTMLTextAreaElement).value);
  } else if (semanticRole === "combobox") {
    const inputs = [...element.querySelectorAll("input,textarea")].filter(visible);
    if (inputs.length > 1) return undefined;
    if (inputs.length === 1) {
      values.push((inputs[0] as HTMLInputElement).value);
      const displayed = visibleText(element);
      if (displayed) values.push(displayed);
    }
    else {
      const runs = textRuns(element);
      if (runs.length !== 1) return undefined;
      values.push(runs[0]!);
    }
  } else if ((semanticRole === "textbox" || semanticRole === "searchbox") && element.hasAttribute("contenteditable")) {
    values.push(visibleText(element));
  } else if (semanticRole === "spinbutton" && element.hasAttribute("aria-valuenow")) {
    values.push(element.getAttribute("aria-valuenow")!);
  } else if (semanticRole === "option") {
    values.push(visibleText(element));
  }
  if (!values.length) return undefined;
  if (element.hasAttribute("aria-valuetext")) values.push(element.getAttribute("aria-valuetext")!);
  if (!values.length || new Set(values.map(normalize)).size !== 1) return undefined;
  return values[0];
}

function nativeDisabled(element: Element): boolean {
  if (element.hasAttribute("disabled")) return true;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === "OPTGROUP" && parent.hasAttribute("disabled") && element.tagName === "OPTION") return true;
    if (parent.tagName === "FIELDSET" && parent.hasAttribute("disabled")) {
      const legend = [...parent.children].find(child => child.tagName === "LEGEND");
      if (!legend?.contains(element)) return true;
    }
  }
  return false;
}

function controlState(element: Element, state: StateName, semanticRole: string): { value?: boolean; error?: string } {
  const attribute = element.getAttribute(`aria-${state}`);
  let aria: boolean | undefined;
  if (attribute !== null) {
    if (attribute === "true" || attribute === "false") aria = attribute === "true";
    else if (state === "invalid" && ["grammar", "spelling"].includes(attribute)) aria = true;
    else return { error: `unsupported aria-${state}=${JSON.stringify(attribute)}` };
  }
  let native: boolean | undefined;
  const tag = element.tagName;
  const inputType = tag === "INPUT" ? (element as HTMLInputElement).type : "";
  if (state === "disabled" && ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "OPTION"].includes(tag)) native = nativeDisabled(element);
  if (state === "disabled" && tag === "A" && element.hasAttribute("href")) native = false;
  if (state === "required" && (["SELECT", "TEXTAREA"].includes(tag)
    || (tag === "INPUT" && !["button", "submit", "reset", "hidden", "range", "color", "image"].includes(inputType)))) {
    native = (element as HTMLInputElement).required;
  }
  if (state === "checked" && tag === "INPUT" && ["checkbox", "radio"].includes(inputType)) native = (element as HTMLInputElement).checked;
  if (state === "selected" && tag === "OPTION") native = (element as HTMLOptionElement).selected;
  if (state === "disabled") {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.getAttribute("aria-disabled") === "true") {
        if (aria === false) return { error: "aria-disabled=false contradicts disabled ancestor" };
        aria = true;
      }
    }
  }
  const allowed: Record<StateName, string[]> = {
    disabled: ["button", "link", "textbox", "searchbox", "combobox", "spinbutton", "checkbox", "radio", "switch", "tab", "menuitem", "option"],
    required: ["textbox", "searchbox", "combobox", "spinbutton", "checkbox"],
    invalid: ["textbox", "searchbox", "combobox", "spinbutton", "checkbox", "radio"],
    expanded: ["button", "link", "combobox", "menuitem", "tab"],
    selected: ["option", "tab"],
    checked: ["checkbox", "radio", "switch"],
  };
  if (!allowed[state].includes(semanticRole) && native === undefined) return { error: `state ${state} is not supported for role ${semanticRole}` };
  if (native !== undefined && aria !== undefined && native !== aria
    && (native || state === "checked" || state === "selected")) {
    return { error: `native ${state}=${native} contradicts aria-${state}=${aria}` };
  }
  return { value: aria ?? native ?? (state === "disabled" ? false : undefined) };
}

function isColumnHeader(cell: Element): boolean {
  if (cell.tagName !== "TH") return role(cell) === "columnheader";
  const scope = cell.getAttribute("scope");
  if (scope === "row" || scope === "rowgroup") return false;
  if (scope === "col" || scope === "colgroup") return true;
  const row = closestRole(cell.parentElement, rowRoles);
  return !!row && cells(row).every(item => item.tagName === "TH" || role(item) === "columnheader");
}

function column(cell: Element, rowCells: Element[]): number | undefined {
  if (cell.hasAttribute("aria-colindex")) {
    const index = Number(cell.getAttribute("aria-colindex"));
    return Number.isSafeInteger(index) && index > 0 ? index : undefined;
  }
  if (rowCells.some(item => item.hasAttribute("aria-colindex"))) return undefined;
  if (rowCells.some(item => ["colspan", "rowspan", "aria-colspan", "aria-rowspan"]
    .some(attribute => item.hasAttribute(attribute) && item.getAttribute(attribute) !== "1"))) return undefined;
  const index = rowCells.indexOf(cell);
  return index === -1 ? undefined : index + 1;
}

function recordChecks(row: Element, fields: { label: string; value: string }[]): Check[] {
  const table = closestRole(row.parentElement, tableRoles);
  if (!table) return [check("table-relationship", false, "Record row has no semantic table/grid owner.")];
  const rows = all(table).filter(element => role(element) === "row"
    && closestRole(element.parentElement, tableRoles) === table && visible(element));
  const rowCells = cells(row);
  const headers = rows.flatMap(cells).filter(isColumnHeader);
  const checks: Check[] = [];
  for (const field of fields) {
    const matchingHeaders = headers.filter(header => visibleText(header) === normalize(field.label));
    if (matchingHeaders.length !== 1) {
      checks.push(check("record-header", false, `Column ${JSON.stringify(field.label)} requires one header; found ${matchingHeaders.length}.`));
      continue;
    }
    const header = matchingHeaders[0]!;
    const headerRow = closestRole(header.parentElement, rowRoles)!;
    const headerIndex = column(header, cells(headerRow));
    const matchingCells = rowCells.filter(cell => {
      if (cell.hasAttribute("headers")) {
        const ids = normalize(cell.getAttribute("headers") ?? "").split(" ").filter(Boolean);
        return ids.length > 0 && new Set(ids).size === ids.length
          && ids.every(id => {
            const references = referenced(row.ownerDocument, id);
            return references.length === 1 && headers.includes(references[0]!);
          }) && ids.some(id => referenced(row.ownerDocument, id)[0] === header);
      }
      // Spanning cells make positional inference unsafe, even in a simple target row.
      const spanning = rows.some(candidate => cells(candidate).some(item =>
        ["rowspan", "aria-rowspan", "colspan", "aria-colspan"]
          .some(attribute => item.hasAttribute(attribute) && item.getAttribute(attribute) !== "1")));
      const explicitIndices = header.hasAttribute("aria-colindex") && cell.hasAttribute("aria-colindex");
      return !spanning && (explicitIndices || rowCells.length === cells(headerRow).length)
        && headerIndex !== undefined && column(cell, rowCells) === headerIndex;
    });
    checks.push(check("record-relationship", matchingCells.length === 1,
      `Column ${JSON.stringify(field.label)} requires one associated cell in the anchored row; found ${matchingCells.length}.`));
    if (matchingCells.length === 1) {
      const actual = visibleText(matchingCells[0]!);
      checks.push(check("record-value", actual === normalize(field.value),
        `Column ${JSON.stringify(field.label)} expected ${JSON.stringify(field.value)}; observed ${JSON.stringify(actual)}.`));
    }
  }
  return checks;
}
