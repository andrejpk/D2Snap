import { NodeType } from "./enums.js";
import { DEFAULT_NORMALIZE_LABEL_ATTRIBUTE_NAMES } from "./var.DEFAULTS_ATTRIBUTES.js";
import { SVG_LABEL_TAG_NAMES } from "./var.SEMANTICS_TAGS.js";


function normalizeCaseInsensitive(str: string): string {
	return str.toUpperCase();
}

function elementHasTagName(elementNode: Element, tagName: string): boolean {
	return normalizeCaseInsensitive(elementNode.tagName) === normalizeCaseInsensitive(tagName);
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

function getElementLabelAttribute(elementNode: Element, document: Document, labelAttributeNames: string[]): string | null {
	for(const labelAttributeName of labelAttributeNames) {
		const labelAttributeValue: string = resolveAttributeAsString(elementNode, labelAttributeName);

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

function resolveLabel(liveElement: Element, document: Document): string | null {
	// Live DOM is never mutated, so labels (and label references) remain resolvable.
	return getElementLabelAttribute(liveElement, document, DEFAULT_NORMALIZE_LABEL_ATTRIBUTE_NAMES);
}

function createImage(document: Document, alt: string = ""): HTMLImageElement {
	const imgSubstituteElementNode: HTMLImageElement = document.createElement("img");

	alt
		&& imgSubstituteElementNode.setAttribute("alt", alt);

	return imgSubstituteElementNode;
}

function replaceElementByImage(elementNode: Element, document: Document, alt: string = "") {
	const imgSubstituteElementNode: HTMLImageElement = createImage(document, alt);

	elementNode.replaceWith(imgSubstituteElementNode);

	return imgSubstituteElementNode;
}


// Meta-image to image.
export default function(virtualNode: Node, liveNode: Node, document: Document): void {
	if(virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;

	const virtualElement = virtualNode as Element;
	const liveElement = liveNode as Element;

	if(!elementHasTagName(virtualElement, "SVG")) return;

	let labelValue: string = "";
	for(const svgLabelTagName of SVG_LABEL_TAG_NAMES) {
		labelValue = (virtualElement.querySelector(svgLabelTagName.toLowerCase())?.textContent ?? "").trim();
		if(labelValue) break;
	}

	labelValue ||= resolveLabel(liveElement, document) ?? "";

	replaceElementByImage(virtualElement, document, labelValue);
}
