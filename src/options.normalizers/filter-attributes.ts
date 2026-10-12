import { type NormalizerContext } from "../types.js";
import { forAttributes } from "./util.normalizers.js";


export interface FilterAttributesSettings {
	attributeNames: readonly string[];
}


const ATTRIBUTE_NAME_SETS_BY_LIST: WeakMap<readonly string[], Set<string>> = new WeakMap();
const ATTRIBUTE_NAME_SETS_BY_KEY: Map<string, Set<string>> = new Map();


export const DEFAULT_SETTINGS: Readonly<FilterAttributesSettings> = Object.freeze({
	attributeNames: Object.freeze([])
});


function normalizeCaseInsensitive(str: string): string {
	return str.toUpperCase();
}

function normalizeCaseInsensitiveArray(tagNames: readonly string[]): string[] {
	return tagNames
		.map((tagName: string) => normalizeCaseInsensitive(tagName));
}

function resolveAttributeNameSet(attributeNames: readonly string[]): Set<string> {
	let attributeNameSet: Set<string> | undefined = ATTRIBUTE_NAME_SETS_BY_LIST.get(attributeNames);
	if(attributeNameSet) return attributeNameSet;

	// Equal lists (e.g., created per call) share one set.
	const normalizedAttributeNames: string[] = normalizeCaseInsensitiveArray(attributeNames);
	const key: string = normalizedAttributeNames.join("\n");

	attributeNameSet = ATTRIBUTE_NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedAttributeNames);

	ATTRIBUTE_NAME_SETS_BY_KEY.set(key, attributeNameSet);
	ATTRIBUTE_NAME_SETS_BY_LIST.set(attributeNames, attributeNameSet);

	return attributeNameSet;
}


export default forAttributes<FilterAttributesSettings>((
	virtualAttr: Attr,
	_liveAttr: Attr,
	_context: NormalizerContext,
	settings: Partial<FilterAttributesSettings> = {}
): void => {
	const attributeNames: Set<string> = resolveAttributeNameSet(settings.attributeNames ?? DEFAULT_SETTINGS.attributeNames);

	if(attributeNames.has(normalizeCaseInsensitive(virtualAttr.name))) {
		virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
	}
});
