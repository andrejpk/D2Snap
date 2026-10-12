import { type NormalizerContext } from "../types.js";
import { forElements } from "./util.normalizers.js";


export interface FilterEmptyImagesSettings {
	labelAttributeNames: readonly string[];
}


export const DEFAULT_SETTINGS: Readonly<FilterEmptyImagesSettings> = Object.freeze({
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

function resolveLabel(liveElement: Element, document: Document, labelAttributeNames: readonly string[]): string | null {
	// Live DOM is never mutated, so labels (and label references) remain resolvable.
	return getElementLabelAttribute(liveElement, document, labelAttributeNames);
}


export default forElements<FilterEmptyImagesSettings>((
	virtualElement: Element,
	liveElement: Element,
	context: NormalizerContext,
	settings: Partial<FilterEmptyImagesSettings> = {}
): void => {
	const document: Document = context.document;
	const labelAttributeNames: readonly string[] = settings.labelAttributeNames ?? DEFAULT_SETTINGS.labelAttributeNames;

	if(elementHasTagName(virtualElement, "IMG") && !resolveLabel(liveElement, document, labelAttributeNames)) {
		if(
			!resolveAttributeAsString(virtualElement, "src")
			&& !resolveAttributeAsString(virtualElement, "alt")
		 ) {
			virtualElement.remove();
		}
	}
});
