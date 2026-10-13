import { isInlineElement, isVoidElement } from "../util.html.js";
import { type NormalizerContext } from "../types.js";
import { forElements } from "./util.normalizers.js";
import { CONFIG } from "../config.js";


export interface AssignUniqueIdsSettings {
	attributeName: string;
}


export const DEFAULT_SETTINGS: Readonly<AssignUniqueIdsSettings> = Object.freeze({
	attributeName: CONFIG.uniqueAttributeName
});

// Per live document and attribute: next candidate ID (monotonic across snapshots).
const NEXT_UNIQUE_IDS: WeakMap<Document, Map<string, number>> = new WeakMap();
// Per snapshot (virtual document) and attribute: IDs occupied in the live document. Scanned upon
// the first allocation of a snapshot, as the page may assign IDs between snapshots.
const OCCUPIED_UNIQUE_IDS: WeakMap<Document, Map<string, Set<string>>> = new WeakMap();


function resolveAttributeAsString(elementNode: Element, attributeName: string): string {
	return (elementNode.getAttribute(attributeName) ?? "").trim();
}

function resolveMap<K extends object, V>(map: WeakMap<K, Map<string, V>>, key: K): Map<string, V> {
	!map.has(key)
		&& map.set(key, new Map());

	return map.get(key)!;
}

function allocateUniqueID(liveDocument: Document, virtualDocument: Document, attributeName: string): string {
	const occupiedUniqueIDsByAttribute: Map<string, Set<string>> = resolveMap(OCCUPIED_UNIQUE_IDS, virtualDocument);

	if(!occupiedUniqueIDsByAttribute.has(attributeName)) {
		occupiedUniqueIDsByAttribute.set(attributeName, new Set(
			[ ...liveDocument.querySelectorAll(`[${attributeName}]`) ]
				.map((elementNode: Element) => resolveAttributeAsString(elementNode, attributeName))
		));
	}

	const occupiedUniqueIDs: Set<string> = occupiedUniqueIDsByAttribute.get(attributeName)!;
	const nextUniqueIDs: Map<string, number> = resolveMap(NEXT_UNIQUE_IDS, liveDocument);

	// Continue after IDs present from earlier snapshots
	let uniqueID: number = nextUniqueIDs.get(attributeName)
		?? ([ ...occupiedUniqueIDs ].reduce((max: number, id: string) => Math.max(max, parseInt(id) || 0), -1) + 1);

	// Skip IDs assigned by the page in the meantime
	while(occupiedUniqueIDs.has(uniqueID.toString())) uniqueID++;

	occupiedUniqueIDs.add(uniqueID.toString());
	nextUniqueIDs.set(attributeName, uniqueID + 1);

	return uniqueID.toString();
}


// Unique ID per live element (stable across snapshots), mirrored to the virtual element.
export default forElements<AssignUniqueIdsSettings>((
	virtualElement: Element,
	liveElement: Element,
	context: NormalizerContext,
	settings: Partial<AssignUniqueIdsSettings> = {}
): void => {
	const attributeName: string = settings.attributeName ?? DEFAULT_SETTINGS.attributeName;

	// No live counterpart (inserted by a normalizer)
	if(liveElement === virtualElement) return;

	if(isInlineElement(liveElement.tagName) && isVoidElement(liveElement.tagName)) return;

	let uniqueID: string = resolveAttributeAsString(liveElement, attributeName);

	if(!uniqueID) {
		uniqueID = allocateUniqueID(liveElement.ownerDocument, context.document, attributeName);

		liveElement.setAttribute(attributeName, uniqueID);
	}

	virtualElement.setAttribute(attributeName, uniqueID);
});
