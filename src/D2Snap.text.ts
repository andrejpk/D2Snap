// -------------------------------------
// Copyright (c) Thassilo M. Schiepanski
// -------------------------------------

import { type ElementClassifierFn, type SentenceRankerFn } from "./types.js";
import { NodeType } from "./enums.js";


const SENTENCE_BOUNDARY_REGEX: RegExp = /(?<=\p{Sentence_Terminal})\s+/gu;


interface TextRange {
	start: number;
	end: number;
}

interface Sentence extends TextRange {
	// Untrimmed segment bounds (up to the boundary whitespace)
	segmentStart: number;
	segmentEnd: number;
}

// A sibling element at its position within the text (between the text nodes).
export interface SiblingElement {
	element: Element;
	position: number;
}


function intersect(range: TextRange, start: number, end: number): TextRange | null {
	const intersectionStart: number = Math.max(range.start, start);
	const intersectionEnd: number = Math.min(range.end, end);

	return (intersectionStart < intersectionEnd)
		? { start: intersectionStart, end: intersectionEnd }
		: null;
}

// Sentences as content ranges (trimmed) within the text, with their untrimmed segment bounds.
function segmentSentences(text: string): Sentence[] {
	const sentences: Sentence[] = [];
	const pushSentence = (start: number, end: number) => {
		const segment: string = text.slice(start, end);
		const leading: number = segment.length - segment.trimStart().length;
		const trailing: number = segment.length - segment.trimEnd().length;

		(start + leading < end - trailing)
			&& sentences.push({ start: start + leading, end: end - trailing, segmentStart: start, segmentEnd: end });
	};

	let start: number = 0;
	for(const boundary of text.matchAll(SENTENCE_BOUNDARY_REGEX)) {
		pushSentence(start, boundary.index);

		start = boundary.index + boundary[0].length;
	}
	pushSentence(start, text.length);

	return sentences;
}

// Index of the sentence an element position belongs to: the sentence whose segment contains it
// (e.g., a footnote marker right after a sentence end); within boundary whitespace, the next one.
// -1 after the last sentence (belongs to no sentence).
function resolveSentenceIndex(sentences: Sentence[], position: number): number {
	for(let i = 0; i < sentences.length; i++) {
		if(position <= sentences[i].segmentEnd) return i;
	}

	return -1;
}

// Indices of the kept sentences (highest-ranked share, at least one), in original order.
// Prioritised sentences are ranked separately and rank first.
function rankSentenceIndices(
	sentences: string[],
	ratio: number,
	sentenceRanker: SentenceRankerFn,
	prioritisedIndices: Set<number> = new Set()
): number[] {
	const k: number = Math.min(Math.max(Math.ceil(sentences.length * ratio), 1), sentences.length);

	if(k >= sentences.length) return sentences.map((_, i) => i);

	// Ranks a group of sentences (by index) among each other
	const rankGroup = (indices: number[]): number[] => {
		if(!indices.length) return [];

		const indicesBySentence: Map<string, number[]> = new Map();
		indices.forEach((index: number) => {
			indicesBySentence.set(sentences[index], [ ...(indicesBySentence.get(sentences[index]) ?? []), index ]);
		});

		const rankedIndices: number[] = [];
		for(const sentence of sentenceRanker(indices.map((index: number) => sentences[index]))) {
			const index: number | undefined = indicesBySentence.get(sentence)?.shift();

			(index !== undefined)
				&& rankedIndices.push(index);
		}

		return rankedIndices;
	};

	const allIndices: number[] = sentences.map((_, i) => i);

	return [
		...rankGroup(allIndices.filter((index: number) => prioritisedIndices.has(index))),
		...rankGroup(allIndices.filter((index: number) => !prioritisedIndices.has(index)))
	]
		.slice(0, k)
		.sort((a, b) => a - b);
}

// Downsamples sibling text nodes (the direct text nodes of one parent) as one text: sentences are
// ranked across the sibling elements in between (not part of the text), and the kept sentences are
// applied back to the text nodes. Sibling elements belong to the sentence at their position: they
// are removed with dropped sentences, except actionable elements, which are always kept. Sentences
// with actionable elements are ranked separately and rank first, so actionables tend to keep their
// context.
export function snapTextSiblings(
	textNodes: Text[],
	siblingElements: SiblingElement[],
	ratio: number,
	sentenceRanker: SentenceRankerFn,
	isActionableElement: ElementClassifierFn<Element>
): void {
	const offsets: TextRange[] = [];
	let text: string = "";

	for(const textNode of textNodes) {
		offsets.push({ start: text.length, end: text.length + textNode.data.length });

		text += textNode.data;
	}

	const sentences: Sentence[] = segmentSentences(text);
	if(!sentences.length) return;

	const sentenceIndexByElement: Map<Element, number> = new Map(siblingElements
		.map((sibling: SiblingElement) => [ sibling.element, resolveSentenceIndex(sentences, sibling.position) ]));
	const actionableSentenceIndices: Set<number> = new Set(siblingElements
		.filter((sibling: SiblingElement) => isActionableElement(sibling.element))
		.map((sibling: SiblingElement) => sentenceIndexByElement.get(sibling.element)!)
		.filter((index: number) => index >= 0));

	// Ranked as visible: the text of the sentence's elements inserted at their positions
	const visibleSentences: string[] = sentences.map((sentence: Sentence, sentenceIndex: number) => {
		let visibleText: string = "";
		let cursor: number = sentence.start;

		for(const sibling of siblingElements) {
			if(sentenceIndexByElement.get(sibling.element) !== sentenceIndex) continue;

			const position: number = Math.min(Math.max(sibling.position, sentence.start), sentence.end);

			visibleText += text.slice(cursor, position) + (sibling.element.textContent ?? "");
			cursor = position;
		}

		return (visibleText + text.slice(cursor, sentence.end)).replace(/\s+/g, " ").trim();
	});

	const keptIndices: number[] = rankSentenceIndices(
		visibleSentences,
		ratio,
		sentenceRanker,
		actionableSentenceIndices
	);
	// Nothing dropped: the text stays untouched
	if(keptIndices.length === sentences.length) return;

	// Kept ranges: adjacent kept sentences merge (incl. the original whitespace in between)
	const keptRanges: TextRange[] = [];
	keptIndices.forEach((index: number, i: number) => {
		const isAdjacent: boolean = (i > 0) && (keptIndices[i - 1] === index - 1);

		isAdjacent
			? (keptRanges[keptRanges.length - 1].end = sentences[index].end)
			: keptRanges.push({ ...sentences[index] });
	});

	textNodes.forEach((textNode: Text, i: number) => {
		const { start, end } = offsets[i];
		const parts: TextRange[] = keptRanges
			.map((range: TextRange) => intersect(range, start, end))
			.filter((part: TextRange | null): part is TextRange => !!part);

		if(!parts.length) {
			// Dropped: a space keeps the surrounding elements apart
			textNode.data.length
				&& (textNode.data = " ");

			return;
		}

		const keptText: string = parts
			.map((part: TextRange) => text.slice(part.start, part.end))
			.join(" ");
		// Spaces where text was dropped (towards the sibling elements)
		const leadingSpace: string = (parts[0].start > start) ? " " : "";
		const trailingSpace: string = (parts[parts.length - 1].end < end) ? " " : "";

		textNode.data = `${leadingSpace}${keptText}${trailingSpace}`;
	});

	// Sibling elements belong to their sentence: removed with dropped sentences (actionables kept)
	const keptIndexSet: Set<number> = new Set(keptIndices);
	for(const { element } of siblingElements) {
		const sentenceIndex: number = sentenceIndexByElement.get(element)!;

		if(sentenceIndex < 0 || keptIndexSet.has(sentenceIndex)) continue;
		if(isActionableElement(element)) continue;

		element.remove();
	}

	// Single spaces where removed elements left text nodes adjacent
	for(const textNode of textNodes) {
		const previousNode: Node | null = textNode.previousSibling;
		if(previousNode?.nodeType !== NodeType.TEXT_NODE) continue;
		if(!/\s$/.test((previousNode as Text).data) || !/^\s/.test(textNode.data)) continue;

		textNode.data = textNode.data.trimStart();
	}
}

// Downsamples text per element: the direct text nodes of each element form one text. Element
// boundaries are hard boundaries (text within a child element is a text of its own); sibling
// elements do not split a text.
export function snapTextBlocks(
	root: Element,
	ratio: number,
	sentenceRanker: SentenceRankerFn,
	isActionableElement: ElementClassifierFn<Element>
): void {
	const elements: Element[] = [ root ];

	while(elements.length) {
		const element: Element = elements.pop()!;
		// Removed with a dropped sentence of its parent
		if(element !== root && !element.parentNode) continue;

		const textNodes: Text[] = [];
		const siblingElements: SiblingElement[] = [];
		let position: number = 0;

		for(let child: Node | null = element.firstChild; child; child = child.nextSibling) {
			if(child.nodeType === NodeType.TEXT_NODE) {
				textNodes.push(child as Text);

				position += (child as Text).data.length;
			} else if(child.nodeType === NodeType.ELEMENT_NODE) {
				siblingElements.push({ element: child as Element, position });
			}
		}

		textNodes.some((textNode: Text) => textNode.data.trim())
			&& snapTextSiblings(textNodes, siblingElements, ratio, sentenceRanker, isActionableElement);

		// Children after their parent (children removed with a dropped sentence are skipped)
		for(let i = siblingElements.length - 1; i >= 0; i--) {
			elements.push(siblingElements[i].element);
		}
	}
}
