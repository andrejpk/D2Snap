import { JSDOM } from "jsdom";
import { Marked, marked } from "marked";

const excluded = "pre,code,script,style,template,noscript,svg,canvas,textarea";
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function evidenceDOM(output: string, format: "html" | "html-markdown", infer: boolean) {
  let pipe = "\uE000literal-pipe\uE001";
  while (output.includes(pipe)) pipe += "_";
  const parser = new Marked({
    gfm: true,
    extensions: [{
      name: "literalPipe", level: "inline",
      tokenizer(source) {
        if (source.startsWith("\\|")) return { type: "literalPipe", raw: "\\|" };
      },
      renderer() { return pipe; },
    }],
  });
  const dom = new JSDOM(format === "html" ? output
    : infer ? parser.parse(output, { async: false }) : marked.parse(output, { async: false, gfm: true }));
  const tables = new WeakSet<Element>();
  try {
    if (infer && format === "html-markdown") {
      recoverTables(dom.window.document, tables);
      const walker = dom.window.document.createTreeWalker(dom.window.document, 4);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        node.textContent = node.textContent!.replaceAll(pipe, "|");
      }
    }
    return { dom, tables };
  } catch (error) {
    dom.window.close();
    throw error;
  }
}

function recoverTables(document: Document, recovered: WeakSet<Element>): void {
  if (document.querySelectorAll("*").length > 20_000) throw new Error("Output exceeds reader element limit.");
  for (const container of [document.body, ...document.body.querySelectorAll("*")].reverse()) {
    if (container.closest(excluded) || container.closest("table")) continue;
    const nodes: Element[] = [];
    let marker = "\uE002inline-node";
    while (container.textContent?.includes(marker)) marker += "_";
    const token = (index: number) => `${marker}${index}\uE003`;
    let stream = "";
    for (const child of container.childNodes) {
      if (child.nodeType === 3) stream += escape(child.textContent ?? "");
      else if (child.nodeType === 1) {
        nodes.push(child as Element);
        stream += token(nodes.length - 1);
      }
    }
    if (!stream.includes("|")) continue;
    const cuts: number[] = [];
    for (let i = 0; i < stream.length; i++) {
      if (stream[i] !== "|") continue;
      let slashes = 0;
      for (let j = i - 1; j >= 0 && stream[j] === "\\"; j--) slashes++;
      if (slashes % 2 === 0) cuts.push(i);
    }
    const pieces = [-1, ...cuts].map((position, i) => stream.slice(position + 1, cuts[i] ?? stream.length));
    const runs: { start: number; width: number }[] = [];
    for (let i = 0; i < pieces.length; i++) {
      if (!/^\s*:?-{3,}:?\s*$/.test(pieces[i]!)) continue;
      const start = i;
      while (i < pieces.length && /^\s*:?-{3,}:?\s*$/.test(pieces[i]!)) i++;
      runs.push({ start, width: i - start });
    }
    if (runs.length !== 1) continue;
    const { start, width } = runs[0]!;
    const headerStart = start - width - 1;
    if (width < 2 || headerStart < 1 || pieces[start - 1]!.trim()
      || (pieces[start + width] ?? "missing").trim()) continue;
    const headers = pieces.slice(headerStart, start - 1);
    if (headers.some(h => !h.trim() || h.includes(marker))
      || new Set(headers.map(h => h.trim())).size !== width) continue;
    const rows: string[][] = [];
    let cursor = start + width + 1, endCut = -1;
    let valid = true;
    while (cursor < pieces.length - 1) {
      if (cursor + width >= pieces.length) { valid = false; break; }
      const cells = pieces.slice(cursor, cursor + width);
      if (cells.some(cell => nodes.some((node, i) => cell.includes(token(i))
        && (!["INPUT", "BUTTON", "A", "SPAN", "B", "STRONG", "EM", "I", "SMALL", "CODE"].includes(node.tagName)
          || node.querySelector("pre,script,style,template,table"))))) { valid = false; break; }
      rows.push(cells);
      endCut = cursor + width - 1;
      if (cursor + width === pieces.length - 1) break;
      if (pieces[cursor + width]!.trim()) { valid = false; break; }
      cursor += width + 1;
    }
    if (!valid || !rows.length || endCut < 0) continue;

    function fragment(text: string, inline: boolean): DocumentFragment {
      const template = document.createElement("template");
      template.innerHTML = inline ? marked.parseInline(text.trim(), { async: false, gfm: true }) : text;
      const walker = document.createTreeWalker(template.content, 4);
      const texts: Text[] = [];
      while (walker.nextNode()) texts.push(walker.currentNode as Text);
      for (const textNode of texts) {
        const value = textNode.data;
        if (!value.includes(marker)) continue;
        const replacement = document.createDocumentFragment();
        let position = 0;
        while (position < value.length) {
          const begin = value.indexOf(marker, position);
          if (begin < 0) { replacement.append(value.slice(position)); break; }
          replacement.append(value.slice(position, begin));
          const end = value.indexOf("\uE003", begin);
          const index = Number(value.slice(begin + marker.length, end));
          const original = nodes[index];
          if (end < 0 || !original) throw new Error("Invalid hybrid-reader node reference.");
          // Literal code must not promote serialized HTML into an actionable element.
          replacement.append(textNode.parentElement?.closest("code,pre")
            ? document.createTextNode(original.outerHTML) : original);
          position = end + 1;
        }
        textNode.replaceWith(replacement);
      }
      return template.content;
    }
    const table = document.createElement("table");
    const heading = table.createTHead().insertRow();
    for (const header of headers) {
      const cell = document.createElement("th");
      cell.append(fragment(header, true));
      heading.append(cell);
    }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      for (const value of row) tr.insertCell().append(fragment(value, true));
    }
    const before = fragment(stream.slice(0, cuts[headerStart - 1]!), false);
    const after = fragment(stream.slice(cuts[endCut]! + 1), false);
    container.replaceChildren(before, table, after);
    recovered.add(table);
    if (document.querySelectorAll("*").length > 20_000) throw new Error("Output exceeds reader element limit.");
  }
}
