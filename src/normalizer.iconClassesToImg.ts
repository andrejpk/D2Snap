import { type D2SnapOptions } from "./types.js";
import { NodeType } from "./enums.js";
import { DEFAULT_NORMALIZE_ATTRIBUTE_ICONFONT_VALUES, DEFAULT_NORMALIZE_LABEL_ATTRIBUTE_NAMES } from "./var.DEFAULTS_ATTRIBUTES.js";
import { NON_RENDERED_TAG_NAMES } from "./var.SEMANTICS_TAGS.js";


const UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER: string = "-";


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


export default function(
	virtualNode: Node,
	liveNode: Node,
	document: Document,
	classifiers: D2SnapOptions["classifiers"]
): void {
	if(virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;

	const virtualElement = virtualNode as Element;
	const liveElement = liveNode as Element;

	if(elementHasTagName(virtualElement, "SVG")) return;

	if(elementHasNoTextContent(virtualElement) && virtualElement.children.length === 0) {
		let iconfontsInClass: string | null = null;

		for(const className of [ ...virtualElement.classList ].reverse()) {
			const iconfontName: string | undefined = DEFAULT_NORMALIZE_ATTRIBUTE_ICONFONT_VALUES
				.find((name: string) => {
					return className.startsWith(`${name}${UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER}`)
				});

			if(!iconfontName) continue;

			iconfontsInClass = className
				.slice(iconfontName.length + UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER.length);

			break;
		}

		if(iconfontsInClass) {
			const alt: string = resolveLabel(liveElement, document) ?? iconfontsInClass;

			if(!classifiers.actionableElements(liveElement)) {
				replaceElementByImage(virtualElement, document, alt);
			} else {
				virtualElement.prepend(createImage(document, alt));
			}
		}
	}
}
