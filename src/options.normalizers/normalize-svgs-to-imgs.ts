import { type NormalizerContext } from "../types.js";
import { forElements } from "./util.normalizers.js";
import { SVG_LABEL_TAG_NAMES } from "../constants.semantics.js";


export interface NormalizeSvgsToImgsSettings {
	labelAttributeNames: readonly string[];
}


export const DEFAULT_SETTINGS: Readonly<NormalizeSvgsToImgsSettings> = Object.freeze({
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
export default forElements<NormalizeSvgsToImgsSettings>((
	virtualElement: Element,
	liveElement: Element,
	context: NormalizerContext,
	settings: Partial<NormalizeSvgsToImgsSettings> = {}
): void => {
	const document: Document = context.document;
	const labelAttributeNames: readonly string[] = settings.labelAttributeNames ?? DEFAULT_SETTINGS.labelAttributeNames;

	if(!elementHasTagName(virtualElement, "SVG")) return;

	let labelValue: string = "";
	for(const svgLabelTagName of SVG_LABEL_TAG_NAMES) {
		labelValue = (virtualElement.querySelector(svgLabelTagName.toLowerCase())?.textContent ?? "").trim();
		if(labelValue) break;
	}

	labelValue ||= resolveLabel(liveElement, document, labelAttributeNames) ?? "";

	replaceElementByImage(virtualElement, document, labelValue);
});