import { type NormalizerContext } from "../types.js";
import { NodeType } from "../enums.js";
import { isRawTextElement, isVoidElement } from "../util.html.js";
import { forElements } from "./util.normalizers.js";
import { NON_RENDERED_TAG_NAMES } from "../constants.semantics.js";


export interface NormalizeTextLabelAttributesToContentSettings {
	labelAttributeNames: readonly string[];
}


export const DEFAULT_SETTINGS: Readonly<NormalizeTextLabelAttributesToContentSettings> = Object.freeze({
	labelAttributeNames: Object.freeze([
		"aria-labelledby",
		"aria-label",
		"title"
	])
});


function normalizeCaseInsensitive(str: string): string {
	return str.toUpperCase();
}

function elementHasTagName(elementNode: Element, tagName: string): boolean {
	return normalizeCaseInsensitive(elementNode.tagName) === normalizeCaseInsensitive(tagName);
}

function hasRenderedText(node: Node): boolean {
	for(const child of node.childNodes) {
		if(child.nodeType === NodeType.TEXT_NODE) {
			if((child.nodeValue ?? "").trim()) return true;

			continue;
		}

		if(child.nodeType !== NodeType.ELEMENT_NODE) continue;
		if(NON_RENDERED_TAG_NAMES.has(normalizeCaseInsensitive((child as Element).tagName))) continue;

		if(hasRenderedText(child)) return true;
	}

	return false;
}

function elementHasNoTextContent(elementNode: Element): boolean {
	return !hasRenderedText(elementNode)
		&& ![ ...elementNode.querySelectorAll("img[alt]") ]
			.some((image: Element) => !!resolveAttributeAsString(image, "alt"));
}

function resolveAttributeAsString(elementNode: Element, attributeName: string): string {
	return (elementNode.getAttribute(attributeName) ?? "").trim();
}

function resolveIdReferenceText(elementNode: Element, document: Document, id: string): string {
	const selector: string = `[id="${id.replace(/["\\]/g, "\\$&")}"]`;
	const scopes: ParentNode[] = [ elementNode.getRootNode() as ParentNode, document ];

	for(const scope of scopes) {
		for(const candidate of scope.querySelectorAll?.(selector) ?? []) {
			const text: string = (candidate.textContent ?? "").trim();

			if(text) return text;
		}
	}

	return "";
}

function getElementLabelAttribute(elementNode: Element, document: Document, labelAttributeNames: readonly string[]): string | null {
	for(const labelAttributeName of labelAttributeNames) {
		// Lower case: attribute names are case-sensitive on non-HTML elements (e.g., SVG)
		const labelAttributeValue: string = resolveAttributeAsString(elementNode, labelAttributeName.toLowerCase());

		if(!labelAttributeValue) continue;

		if(normalizeCaseInsensitive(labelAttributeName) !== normalizeCaseInsensitive("aria-labelledby")) {
			return labelAttributeValue;
		}

		const referencedText: string = labelAttributeValue
			.split(/\s+/)
			.map((id: string) => resolveIdReferenceText(elementNode, document, id))
			.filter(Boolean)
			.join(" ");

		if(referencedText) return referencedText;
	}

	return null;
}

function resolveLabel(liveElement: Element, document: Document, labelAttributeNames: readonly string[]): string | null {
	// Live DOM is never mutated, so labels (and label references) remain resolvable.
	return getElementLabelAttribute(liveElement, document, labelAttributeNames);
}


// Text-label attributes to text (non-void elements) or 'alt' (image elements).
export default forElements<NormalizeTextLabelAttributesToContentSettings>((
	virtualElement: Element,
	liveElement: Element,
	context: NormalizerContext,
	settings: Partial<NormalizeTextLabelAttributesToContentSettings> = {}
): void => {
	const document: Document = context.document;
	const labelAttributeNames: readonly string[] = settings.labelAttributeNames ?? DEFAULT_SETTINGS.labelAttributeNames;

	if(!isRawTextElement(virtualElement.tagName)) {
		const labelAttributeValue: string | null = resolveLabel(liveElement, document, labelAttributeNames);

		if(labelAttributeValue) {
			if(elementHasTagName(virtualElement, "IMG")) {
				// Image
				const altAttributeValue: string = resolveAttributeAsString(virtualElement, "alt");
				!altAttributeValue
					&& virtualElement.setAttribute("alt", labelAttributeValue);
			} else if(!isVoidElement(virtualElement.tagName)) {
				// Text
				elementHasNoTextContent(virtualElement)
					&& virtualElement.prepend(labelAttributeValue);
			}
		}
	}
});