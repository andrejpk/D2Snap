import { isInlineElement, isVoidElement } from "../util.html.js";
import { type NormalizerContext } from "../types.js";
import { forElements } from "./util.normalizers.js";
import { CONFIG } from "../config.js";


export interface UniqueIDsSettings {
	attributeName: string;
}


export const DEFAULT_SETTINGS: Readonly<UniqueIDsSettings> = Object.freeze({
	attributeName: CONFIG.uniqueAttributeName
});

const NEXT_UNIQUE_IDS: WeakMap<Document, Map<string, number>> = new WeakMap();


function resolveAttributeAsString(elementNode: Element, attributeName: string): string {
	return (elementNode.getAttribute(attributeName) ?? "").trim();
}

function resolveNextUniqueID(liveDocument: Document, attributeName: string): number {
	!NEXT_UNIQUE_IDS.has(liveDocument)
		&& NEXT_UNIQUE_IDS.set(liveDocument, new Map());

	const nextUniqueIDs: Map<string, number> = NEXT_UNIQUE_IDS.get(liveDocument)!;

	if(!nextUniqueIDs.has(attributeName)) {
		// Continue after IDs present from earlier snapshots
		const maxUniqueID: number = [ ...liveDocument.querySelectorAll(`[${attributeName}]`) ]
			.reduce((max: number, elementNode: Element) => {
				return Math.max(max, parseInt(resolveAttributeAsString(elementNode, attributeName)) || 0);
			}, -1);

		nextUniqueIDs.set(attributeName, maxUniqueID + 1);
	}

	const uniqueID: number = nextUniqueIDs.get(attributeName)!;

	nextUniqueIDs.set(attributeName, uniqueID + 1);

	return uniqueID;
}


// Unique ID per live element (stable across snapshots), mirrored to the virtual element.
export default forElements<UniqueIDsSettings>((
	virtualElement: Element,
	liveElement: Element,
	_context: NormalizerContext,
	settings: Partial<UniqueIDsSettings> = {}
): void => {
	const attributeName: string = settings.attributeName ?? DEFAULT_SETTINGS.attributeName;

	// No live counterpart (inserted by a normalizer)
	if(liveElement === virtualElement) return;

	if(isInlineElement(liveElement.tagName) && isVoidElement(liveElement.tagName)) return;

	let uniqueID: string = resolveAttributeAsString(liveElement, attributeName);

	if(!uniqueID) {
		uniqueID = resolveNextUniqueID(liveElement.ownerDocument, attributeName).toString();

		liveElement.setAttribute(attributeName, uniqueID);
	}

	virtualElement.setAttribute(attributeName, uniqueID);
});
