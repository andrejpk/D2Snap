import { NodeType } from "./enums.js";
const SENTENCE_BOUNDARY_REGEX = /(?<=\p{Sentence_Terminal})\s+/gu;
function intersect(range, start, end) {
  const intersectionStart = Math.max(range.start, start);
  const intersectionEnd = Math.min(range.end, end);
  return intersectionStart < intersectionEnd ? { start: intersectionStart, end: intersectionEnd } : null;
}
function segmentSentences(text) {
  const sentences = [];
  const pushSentence = (start2, end) => {
    const segment = text.slice(start2, end);
    const leading = segment.length - segment.trimStart().length;
    const trailing = segment.length - segment.trimEnd().length;
    start2 + leading < end - trailing && sentences.push({ start: start2 + leading, end: end - trailing, segmentStart: start2, segmentEnd: end });
  };
  let start = 0;
  for (const boundary of text.matchAll(SENTENCE_BOUNDARY_REGEX)) {
    pushSentence(start, boundary.index);
    start = boundary.index + boundary[0].length;
  }
  pushSentence(start, text.length);
  return sentences;
}
function resolveSentenceIndex(sentences, position) {
  for (let i = 0; i < sentences.length; i++) {
    if (position <= sentences[i].segmentEnd) return i;
  }
  return -1;
}
function rankSentenceIndices(sentences, ratio, sentenceRanker, prioritisedIndices = /* @__PURE__ */ new Set()) {
  const k = Math.min(Math.max(Math.ceil(sentences.length * ratio), 1), sentences.length);
  if (k >= sentences.length) return sentences.map((_, i) => i);
  const rankGroup = (indices) => {
    if (!indices.length) return [];
    const indicesBySentence = /* @__PURE__ */ new Map();
    indices.forEach((index) => {
      indicesBySentence.set(sentences[index], [...indicesBySentence.get(sentences[index]) ?? [], index]);
    });
    const rankedIndices = [];
    for (const sentence of sentenceRanker(indices.map((index) => sentences[index]))) {
      const index = indicesBySentence.get(sentence)?.shift();
      index !== void 0 && rankedIndices.push(index);
    }
    return rankedIndices;
  };
  const allIndices = sentences.map((_, i) => i);
  return [
    ...rankGroup(allIndices.filter((index) => prioritisedIndices.has(index))),
    ...rankGroup(allIndices.filter((index) => !prioritisedIndices.has(index)))
  ].slice(0, k).sort((a, b) => a - b);
}
function snapTextSiblings(textNodes, siblingElements, ratio, sentenceRanker, isActionableElement) {
  const offsets = [];
  let text = "";
  for (const textNode of textNodes) {
    offsets.push({ start: text.length, end: text.length + textNode.data.length });
    text += textNode.data;
  }
  const sentences = segmentSentences(text);
  if (!sentences.length) return;
  const sentenceIndexByElement = new Map(siblingElements.map((sibling) => [sibling.element, resolveSentenceIndex(sentences, sibling.position)]));
  const actionableSentenceIndices = new Set(siblingElements.filter((sibling) => isActionableElement(sibling.element)).map((sibling) => sentenceIndexByElement.get(sibling.element)).filter((index) => index >= 0));
  const visibleSentences = sentences.map((sentence, sentenceIndex) => {
    let visibleText = "";
    let cursor = sentence.start;
    for (const sibling of siblingElements) {
      if (sentenceIndexByElement.get(sibling.element) !== sentenceIndex) continue;
      const position = Math.min(Math.max(sibling.position, sentence.start), sentence.end);
      visibleText += text.slice(cursor, position) + (sibling.element.textContent ?? "");
      cursor = position;
    }
    return (visibleText + text.slice(cursor, sentence.end)).replace(/\s+/g, " ").trim();
  });
  const keptIndices = rankSentenceIndices(
    visibleSentences,
    ratio,
    sentenceRanker,
    actionableSentenceIndices
  );
  if (keptIndices.length === sentences.length) return;
  const keptRanges = [];
  keptIndices.forEach((index, i) => {
    const isAdjacent = i > 0 && keptIndices[i - 1] === index - 1;
    isAdjacent ? keptRanges[keptRanges.length - 1].end = sentences[index].end : keptRanges.push({ ...sentences[index] });
  });
  textNodes.forEach((textNode, i) => {
    const { start, end } = offsets[i];
    const parts = keptRanges.map((range) => intersect(range, start, end)).filter((part) => !!part);
    if (!parts.length) {
      textNode.data.length && (textNode.data = " ");
      return;
    }
    const keptText = parts.map((part) => text.slice(part.start, part.end)).join(" ");
    const leadingSpace = parts[0].start > start ? " " : "";
    const trailingSpace = parts[parts.length - 1].end < end ? " " : "";
    textNode.data = `${leadingSpace}${keptText}${trailingSpace}`;
  });
  const keptIndexSet = new Set(keptIndices);
  for (const { element } of siblingElements) {
    const sentenceIndex = sentenceIndexByElement.get(element);
    if (sentenceIndex < 0 || keptIndexSet.has(sentenceIndex)) continue;
    if (isActionableElement(element)) continue;
    element.remove();
  }
  for (const textNode of textNodes) {
    const previousNode = textNode.previousSibling;
    if (previousNode?.nodeType !== NodeType.TEXT_NODE) continue;
    if (!/\s$/.test(previousNode.data) || !/^\s/.test(textNode.data)) continue;
    textNode.data = textNode.data.trimStart();
  }
}
function snapTextBlocks(root, ratio, sentenceRanker, isActionableElement) {
  const elements = [root];
  while (elements.length) {
    const element = elements.pop();
    if (element !== root && !element.parentNode) continue;
    const textNodes = [];
    const siblingElements = [];
    let position = 0;
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === NodeType.TEXT_NODE) {
        textNodes.push(child);
        position += child.data.length;
      } else if (child.nodeType === NodeType.ELEMENT_NODE) {
        siblingElements.push({ element: child, position });
      }
    }
    textNodes.some((textNode) => textNode.data.trim()) && snapTextSiblings(textNodes, siblingElements, ratio, sentenceRanker, isActionableElement);
    for (let i = siblingElements.length - 1; i >= 0; i--) {
      elements.push(siblingElements[i].element);
    }
  }
}
export {
  snapTextBlocks,
  snapTextSiblings
};
