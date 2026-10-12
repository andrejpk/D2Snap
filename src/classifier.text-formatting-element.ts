import { DEFAULT_CLASS_TEXT_TAG_NAMES } from "./var.DEFAULTS_TAGS.js";


const TEXT_ELEMENT_TAG_NAMES: Set<string> = new Set(
	DEFAULT_CLASS_TEXT_TAG_NAMES.map(t => t.toUpperCase())
);


export default function(elementNode: Element): boolean {
	return TEXT_ELEMENT_TAG_NAMES.has(elementNode.tagName.toUpperCase());
}