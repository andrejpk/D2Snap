import { EditorState, StateEffect, StateField } from "@codemirror/state";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, lineNumbers } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { foldedRanges, foldGutter, foldKeymap, HighlightStyle, syntaxHighlighting, unfoldEffect } from "@codemirror/language";
import { html } from "@codemirror/lang-html";
import { tags } from "@lezer/highlight";
import { formatHTMLSource, formattedOffset } from "./source-format.ts";
import type { SourceHighlight, SourceRange } from "./viewer-model.ts";

export interface SourceViewer {
  element: HTMLElement;
  show(): void;
  highlight(value: SourceHighlight | undefined, active: boolean): void;
  destroy(): void;
}

const setHighlight = StateEffect.define<SourceHighlight>();
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setHighlight)) {
      const highlight = effect.value;
      const attributes = {
          "data-bench-source-highlight": highlight.kind,
          "data-provenance": highlight.provenance,
          title: highlight.explanation,
      };
      const spec = { class: `bench-source-${highlight.kind}`, attributes };
      const decorations: Range<Decoration>[] = [];
      const coveredLines = new Set<number>();
      for (const range of highlight.ranges) {
        const first = transaction.state.doc.lineAt(range.from);
        const last = transaction.state.doc.lineAt(range.to - 1);
        for (let number = first.number; number <= last.number; number++) {
          const line = transaction.state.doc.line(number);
          const from = Math.max(range.from, line.from);
          const to = Math.min(range.to, line.to);
          const wholeLine = !line.text.slice(0, from - line.from).trim()
            && !line.text.slice(to - line.from).trim();
          if (wholeLine && !coveredLines.has(line.from)) {
            decorations.push(Decoration.line(spec).range(line.from));
            coveredLines.add(line.from);
          } else if (!wholeLine && to > from) decorations.push(Decoration.mark(spec).range(from, to));
        }
      }
      return Decoration.set(decorations, true);
    }
    return value;
  },
  provide: field => EditorView.decorations.from(field),
});

const highlighting = HighlightStyle.define([
  { tag: tags.tagName, color: "var(--cp-link)" },
  { tag: tags.attributeName, color: "var(--cp-accent)" },
  { tag: [tags.string, tags.attributeValue], color: "var(--cp-success)" },
  { tag: tags.comment, color: "var(--cp-text-muted)", fontStyle: "italic" },
  { tag: [tags.angleBracket, tags.punctuation], color: "var(--cp-text-soft)" },
]);

const editorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--cp-surface)", color: "var(--cp-text)", fontSize: "12px" },
  ".cm-scroller": { overflow: "auto", fontFamily: 'Consolas, "Courier New", Courier, monospace' },
  ".cm-content": { padding: "8px 0" },
  ".cm-gutters": { backgroundColor: "var(--cp-bg-elevated)", color: "var(--cp-text-muted)", borderColor: "var(--cp-border)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--cp-accent-soft)", color: "var(--cp-accent)", borderColor: "var(--cp-border)" },
  ".cm-selectionBackground": { backgroundColor: "var(--cp-highlight)" },
  "&.cm-focused": { outline: "1px solid var(--cp-accent)" },
});

export function createSourceViewer(original: string, side: "raw" | "output"): SourceViewer {
  const element = document.createElement("div");
  element.className = "bench-source-viewer";
  const status = document.createElement("p");
  status.className = "bench-source-status";
  status.setAttribute("role", "status");
  const host = document.createElement("div");
  host.className = "bench-code-host";
  element.append(status, host);
  let editor: EditorView | undefined;
  let initialized = false;
  let disposed = false;
  let selection: SourceHighlight | undefined;
  let revision = 0;
  let formatted = "";
  let formatWarning = "";
  const offsets = new Map<number, Promise<number>>();

  async function paint(): Promise<void> {
    const current = ++revision;
    if (!editor || disposed) return;
    const target = selection;
    editor.dispatch({ effects: setHighlight.of({ ranges: [], kind: "none", provenance: "none", explanation: "" }) });
    if (!target?.ranges.length || target.kind === "none") {
      status.textContent = formatWarning || (target?.provenance === "none"
        ? "Missing: no matching or context source content for this goal."
        : "No source location available for this goal.");
      status.hidden = false;
      return;
    }
    status.hidden = !formatWarning;
    status.textContent = formatWarning;
    try {
      const offset = (position: number): Promise<number> => {
        if (!offsets.has(position)) offsets.set(position, formattedOffset(original, position, formatted));
        return offsets.get(position)!;
      };
      const mapped = await Promise.all(target.ranges.map(async range => {
        if (range.from < 0 || range.to > original.length || range.to <= range.from) throw new Error("Invalid source range.");
        const [from, to] = element.dataset.sourceMode === "original"
          ? [original.slice(0, range.from).replace(/\r\n?/g, "\n").length, original.slice(0, range.to).replace(/\r\n?/g, "\n").length]
          : await Promise.all([offset(range.from), offset(range.to)]);
        if (to <= from) throw new Error("Source range collapsed during formatting.");
        return { from, to };
      }));
      if (disposed || current !== revision || !editor) return;
      const ranges: SourceRange[] = [];
      for (const range of mapped.sort((a, b) => a.from - b.from || a.to - b.to)) {
        const previous = ranges.at(-1);
        if (previous && (range.from <= previous.to || !editor.state.doc.sliceString(previous.to, range.from).trim())) {
          previous.to = Math.max(previous.to, range.to);
        }
        else ranges.push({ ...range });
      }
      const effects: StateEffect<unknown>[] = [setHighlight.of({ ...target, ranges })];
      for (const range of ranges) {
        foldedRanges(editor.state).between(range.from, range.to, (from, to) => { effects.push(unfoldEffect.of({ from, to })); });
      }
      effects.push(EditorView.scrollIntoView(ranges[0]!.from, { y: "center" }));
      editor.dispatch({ effects });
    } catch (error) {
      if (disposed || current !== revision) return;
      console.warn("Source highlight mapping unavailable", error);
      status.hidden = false;
      status.textContent = `Source highlight unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  function render(text: string, mode: "formatted" | "original"): void {
    if (disposed) return;
    editor?.destroy();
    editor = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: text,
        extensions: [
          EditorState.readOnly.of(true), EditorView.editable.of(false),
          EditorView.contentAttributes.of({
            "aria-label": `${mode === "formatted" ? "Formatted" : "Original"} ${side} source`,
            "aria-readonly": "true", role: "textbox", tabindex: "0",
          }),
          lineNumbers(), html(), foldGutter(), keymap.of(foldKeymap),
          syntaxHighlighting(highlighting), editorTheme, highlightField,
        ],
      }),
    });
    element.dataset.sourceMode = mode;
  }

  return {
    element,
    show() {
      if (disposed) return;
      if (initialized) { editor?.requestMeasure(); void paint(); return; }
      initialized = true;
      status.textContent = "Formatting source...";
      void formatHTMLSource(original).then(text => {
        if (disposed) return;
        formatted = text;
        render(text, "formatted");
        void paint();
      }, error => {
        if (disposed) return;
        console.warn("Source formatting failed; showing original source", error);
        formatWarning = `Formatting unavailable; showing original source. ${error instanceof Error ? error.message : String(error)}`;
        render(original, "original");
        void paint();
      });
    },
    highlight(value, active) {
      selection = value;
      revision++;
      if (active) void paint();
    },
    destroy() {
      disposed = true;
      revision++;
      editor?.destroy();
      editor = undefined;
    },
  };
}
