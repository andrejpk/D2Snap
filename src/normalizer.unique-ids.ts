import { NodeType } from "./enums.js";
import { isInlineElement, isVoidElement } from "./util.html.js";
import { CONFIG } from "./var.CONFIG.js";


const NEXT_UNIQUE_IDS: WeakMap<Document, number> = new WeakMap();


function resolveAttributeAsString(elementNode: Element, attributeName: string): string {
	return (elementNode.getAttribute(attributeName) ?? "").trim();
}

function resolveNextUniqueID(liveDocument: Document): number {
	if(!NEXT_UNIQUE_IDS.has(liveDocument)) {
		// Continue after IDs present from earlier snapshots
		const maxUniqueID: number = [ ...liveDocument.querySelectorAll(`[${CONFIG.uniqueAttributeName}]`) ]
			.reduce((max: number, elementNode: Element) => {
				return Math.max(max, parseInt(resolveAttributeAsString(elementNode, CONFIG.uniqueAttributeName)) || 0);
			}, -1);

		NEXT_UNIQUE_IDS.set(liveDocument, maxUniqueID + 1);
	}

	const uniqueID: number = NEXT_UNIQUE_IDS.get(liveDocument)!;

	NEXT_UNIQUE_IDS.set(liveDocument, uniqueID + 1);

	return uniqueID;
}


// Unique ID per live element (stable across snapshots), mirrored to the virtual element.
export default function(virtualNode: Node, liveNode: Node): void {
	if(virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;
	// No live counterpart (inserted by a normalizer)
	if(liveNode === virtualNode) return;

	const virtualElement = virtualNode as Element;
	const liveElement = liveNode as Element;

	if(isInlineElement(liveElement.tagName) && isVoidElement(liveElement.tagName)) return;

	let uniqueID: string = resolveAttributeAsString(liveElement, CONFIG.uniqueAttributeName);

	if(!uniqueID) {
		uniqueID = resolveNextUniqueID(liveElement.ownerDocument).toString();

		liveElement.setAttribute(CONFIG.uniqueAttributeName, uniqueID);
	}

	virtualElement.setAttribute(CONFIG.uniqueAttributeName, uniqueID);
}