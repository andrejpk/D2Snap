import { type NormalizerContext } from "../types.js";
import { NodeType } from "../enums.js";
import { forElements } from "./util.normalizers.js";
import { NON_RENDERED_TAG_NAMES } from "../constants.semantics.js";


export interface IconClassesToImgSettings {
	iconClassPrefixes: readonly string[];
	labelAttributeNames: readonly string[];
}


const UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER: string = "-";


export const DEFAULT_SETTINGS: Readonly<IconClassesToImgSettings> = Object.freeze({
	iconClassPrefixes: Object.freeze([]),
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


export default forElements<IconClassesToImgSettings>((
	virtualElement: Element,
	liveElement: Element,
	context: NormalizerContext,
	settings: Partial<IconClassesToImgSettings> = {}
): void => {
	const document: Document = context.document;
	const labelAttributeNames: readonly string[] = settings.labelAttributeNames ?? DEFAULT_SETTINGS.labelAttributeNames;
	const iconClassPrefixes: readonly string[] = settings.iconClassPrefixes ?? DEFAULT_SETTINGS.iconClassPrefixes;

	if(elementHasTagName(virtualElement, "SVG")) return;

	if(elementHasNoTextContent(virtualElement) && virtualElement.children.length === 0) {
		let iconfontsInClass: string | null = null;

		for(const className of [ ...virtualElement.classList ].reverse()) {
			const iconfontName: string | undefined = iconClassPrefixes
				.find((name: string) => {
					return className.startsWith(`${name}${UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER}`)
				});

			if(!iconfontName) continue;

			iconfontsInClass = className
				.slice(iconfontName.length + UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER.length);

			break;
		}

		if(iconfontsInClass) {
			const alt: string = resolveLabel(liveElement, document, labelAttributeNames) ?? iconfontsInClass;

			if(!context.classifiers.actionableElements(liveElement)) {
				replaceElementByImage(virtualElement, document, alt);
			} else {
				virtualElement.prepend(createImage(document, alt));
			}
		}
	}
});
