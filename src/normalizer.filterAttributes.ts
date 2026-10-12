import { NodeType } from "./enums.js";
import { DEFAULT_FILTER_ATTRIBUTE_NAMES } from "./var.DEFAULTS_ATTRIBUTES.js";


const FILTER_ATTRIBUTES_NAMES: Set<string> = new Set(normalizeCaseInsensitiveArray(DEFAULT_FILTER_ATTRIBUTE_NAMES));


function normalizeCaseInsensitive(str: string): string {
	return str.toUpperCase();
}

function normalizeCaseInsensitiveArray(tagNames: string[]): string[] {
	return tagNames
		.map((tagName: string) => normalizeCaseInsensitive(tagName));
}


export default function(virtualNode: Node): void {
	if(virtualNode.nodeType !== NodeType.ATTRIBUTE_NODE) return;

	const virtualAttr = virtualNode as Attr;

	if(FILTER_ATTRIBUTES_NAMES.has(normalizeCaseInsensitive(virtualAttr.name))) {
		virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
	}
}
