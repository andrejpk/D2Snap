import { JSDOM } from "jsdom";
import { marked } from "marked";
import { inspectEvidence } from "../evidence/index.ts";
import type { Assessment } from "../evidence/index.ts";
import type { CaseState } from "../contracts.ts";
import { themeCSS } from "./theme.ts";
import type { Preview, ViewerData } from "./viewer-model.ts";
import type { DemoReport } from "./models.ts";
import { locateSource } from "./source-locations.ts";
import { presentationOrder } from "./presentation-order.ts";

function renderNestedMarkdown(document: Document): void {
  const walker = document.createTreeWalker(document.body, 4);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (!node.parentElement || node.parentElement.closest("pre,code,textarea,svg,math,style,script")) continue;
    const text = node.textContent ?? "";
    const block = /(^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+\.\s|\|[^\n]+\|)/.test(text);
    const inline = /(?:\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\))/.test(text);
    if (!block && !inline) continue;
    const lines = text.replace(/^\n|\n$/g, "").split("\n");
    const indents = lines.filter(line => line.trim()).map(line => line.match(/^\s*/)?.[0].length ?? 0);
    const indent = indents.length ? Math.min(...indents) : 0;
    const unindented = lines.map(line => line.slice(indent)).join("\n");
    const html = block
      ? marked.parse(unindented, { async: false, gfm: true })
      : marked.parseInline(text, { async: false, gfm: true });
    const template = document.createElement("template");
    template.innerHTML = html;
    node.replaceWith(template.content);
  }
}

function safeCSS(css: string): string {
  return css.replace(/@import\b[^;]*;/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/<\/style/gi, "<\\/style");
}

function inlineImage(source: string, files: Record<string, string>): string | undefined {
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(source)) return source;
  const path = source.replace(/^\/fixture\//, "").replace(/^\.\//, "").split(/[?#]/)[0] ?? "";
  const extension = path.split(".").at(-1)?.toLowerCase();
  const type = extension === "svg" ? "svg+xml" : extension === "jpg" ? "jpeg" : extension;
  if (type && ["svg+xml", "png", "jpeg", "gif", "webp"].includes(type) && Object.hasOwn(files, path)) {
    return `data:image/${type};base64,${files[path]}`;
  }
  return undefined;
}

export function sanitizePreview(html: string, css: string, hybrid: boolean, files: Record<string, string> = {}): string {
  const dom = new JSDOM(html);
  try {
    const document = dom.window.document;
    document.querySelectorAll("script,iframe,frame,frameset,object,embed,base,meta,link,style").forEach(element => element.remove());
    if (hybrid) renderNestedMarkdown(document);
    // Markdown itself can introduce HTML or URLs, so sanitize after rendering too.
    document.querySelectorAll("script,iframe,frame,frameset,object,embed,base,meta,link,style").forEach(element => element.remove());
    for (const element of document.querySelectorAll("*")) {
      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on") || [
          "srcdoc", "srcset", "action", "formaction", "target", "formtarget", "ping", "poster",
          "background", "autofocus", "autoplay",
        ].includes(name)) element.removeAttribute(attribute.name);
        else if (name === "href" || name === "xlink:href") {
          if (!attribute.value.startsWith("#")) element.removeAttribute(attribute.name);
        } else if (name === "src") {
          const source = element.tagName === "IMG" ? inlineImage(attribute.value, files) : undefined;
          if (source) element.setAttribute(attribute.name, source);
          else element.removeAttribute(attribute.name);
        } else if (name === "style") element.setAttribute("style", safeCSS(attribute.value));
      }
    }
    const charset = document.createElement("meta");
    charset.setAttribute("charset", "utf-8");
    const csp = document.createElement("meta");
    csp.httpEquiv = "Content-Security-Policy";
    csp.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'; frame-src 'none'";
    const style = document.createElement("style");
    style.textContent = safeCSS(`${themeCSS}\n${css}\n
      html { scroll-behavior: auto; }
      body { margin: 0; min-width: 0; }
      body.preview-output { padding: 20px; }
      .preview-output table { width: 100%; border-collapse: collapse; }
      .preview-output th, .preview-output td { border: 1px solid var(--cp-border); padding: 8px; }
      .preview-output button, .preview-output input, .preview-output select { font: inherit; padding: 5px 8px; }
      a, button, input, select, textarea { pointer-events: none; }
      [data-bench-highlight="match"] { outline: 3px solid var(--cp-success) !important; outline-offset: 3px !important; background-color: color-mix(in srgb, var(--cp-success) 14%, var(--cp-surface)) !important; }
      [data-bench-highlight="context"] { outline: 3px dashed var(--cp-warning) !important; outline-offset: 3px !important; background-color: color-mix(in srgb, var(--cp-warning) 14%, var(--cp-surface)) !important; }
    `);
    document.head.replaceChildren(charset, csp, style);
    if (hybrid || !css) document.body.classList.add("preview-output");
    document.documentElement.lang = "en";
    document.documentElement.setAttribute("data-theme", "light");
    return `<!doctype html>${document.documentElement.outerHTML}`;
  } finally { dom.window.close(); }
}

export function makePreview(
  output: string, state: CaseState, assessment: Assessment, css = "", files: Record<string, string> = {},
): Preview {
  const inspection = inspectEvidence(output, state, assessment);
  return {
    document: sanitizePreview(inspection.html, css, assessment.reader.format === "html-markdown", files),
    highlights: inspection.highlights,
    sourceHighlights: locateSource(output, state, assessment),
  };
}

export function makeViewerData(report: DemoReport, files: Record<string, string>): ViewerData {
  const css = Object.entries(files).filter(([name]) => name.endsWith(".css"))
    .map(([, bytes]) => Buffer.from(bytes, "base64").toString("utf8")).join("\n");
  const states = Object.entries(report.captures).map(([id, capture]) => {
    const state = report.caseDefinition.states.find(state => state.id === id);
    const raw = report.results.find(result => result.stateId === id && result.profileId === "raw");
    if (!state || !raw) throw new Error(`Missing state definition or raw baseline for ${id}`);
    return {
      id, description: state.description, raw: capture.html,
      rawBytes: Buffer.byteLength(capture.html, "utf8"),
      screenshot: `data:image/png;base64,${capture.screenshot}`,
      preview: makePreview(capture.html, state, raw.assessment, css, files),
    };
  });
  const results = presentationOrder(report.results).map(result => {
    const state = report.caseDefinition.states.find(state => state.id === result.stateId);
    if (!state) throw new Error(`Unknown result state ${result.stateId}`);
    return {
      id: `${result.stateId}-${result.profileId}`,
      stateId: result.stateId, profileId: result.profileId, output: result.output,
      configuration: result.configuration, assessment: result.assessment,
      goals: result.assessment.requirements.map(item => {
        const requirement = state.requirements.find(requirement => requirement.id === item.id);
        if (!requirement) throw new Error(`Unknown goal ${item.id}`);
        return {
          id: item.id, description: requirement.goal, category: item.category, passed: item.passed,
          matchedAlternatives: item.matchedAlternatives, reasons: [...new Set(item.reasons)],
          match: item.match, semanticPassed: item.semanticPassed, inferenceRules: item.inferenceRules,
        };
      }),
      preview: result.profileId === "raw"
        ? states.find(item => item.id === result.stateId)!.preview
        : makePreview(result.output, state, result.assessment, "", files),
    };
  });
  return { schemaVersion: 1, report, states, results };
}
