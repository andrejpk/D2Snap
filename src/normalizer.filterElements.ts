import { NodeType } from "./enums.js";
import { DEFAULT_FILTER_TAG_NAMES } from "./var.DEFAULTS_TAGS.js";


const FILTER_ELEMENTS_TAG_NAMES: Set<string> = new Set(normalizeCaseInsensitiveArray(DEFAULT_FILTER_TAG_NAMES));


function normalizeCaseInsensitive(str: string): string {
	return str.toUpperCase();
}

function normalizeCaseInsensitiveArray(tagNames: string[]): string[] {
	return tagNames
		.map((tagName: string) => normalizeCaseInsensitive(tagName));
}


export default function(virtualNode: Node): void {
	if(virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;

	const virtualElement = virtualNode as Element;

	if(FILTER_ELEMENTS_TAG_NAMES.has(normalizeCaseInsensitive(virtualElement.tagName))) {
		virtualElement.remove();
	}
}
