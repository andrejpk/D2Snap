export interface IsTextElementSettings {
	tagNames: readonly string[];
}


const TAG_NAME_SETS_BY_LIST: WeakMap<readonly string[], Set<string>> = new WeakMap();
const TAG_NAME_SETS_BY_KEY: Map<string, Set<string>> = new Map();


export const DEFAULT_SETTINGS: Readonly<IsTextElementSettings> = Object.freeze({
	tagNames: Object.freeze([
		"ADDRESS",
		"BLOCKQUOTE",
		"B",
		"CODE",
		"EM",
		"FIGURE",
		"FIGCAPTION",
		"H1",
		"H2",
		"H3",
		"H4",
		"H5",
		"H6",
		"HR",
		"IMG",
		"LI",
		"OL",
		"P",
		"PRE",
		"SMALL",
		"SPAN",
		"STRONG",
		"SUB",
		"SUP",
		"TABLE",
		"TBODY",
		"TD",
		"THEAD",
		"TH",
		"TR",
		"UL"
	])
});


function resolveTagNameSet(tagNames: readonly string[]): Set<string> {
	let tagNameSet: Set<string> | undefined = TAG_NAME_SETS_BY_LIST.get(tagNames);
	if(tagNameSet) return tagNameSet;

	// Equal lists (e.g., created per call) share one set.
	const normalizedTagNames: string[] = tagNames.map((tagName: string) => tagName.toUpperCase());
	const key: string = normalizedTagNames.join("\n");

	tagNameSet = TAG_NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedTagNames);

	TAG_NAME_SETS_BY_KEY.set(key, tagNameSet);
	TAG_NAME_SETS_BY_LIST.set(tagNames, tagNameSet);

	return tagNameSet;
}


export default function(elementNode: Element, settings: Partial<IsTextElementSettings> = {}): boolean {
	return resolveTagNameSet(settings.tagNames ?? DEFAULT_SETTINGS.tagNames)
		.has(elementNode.tagName.toUpperCase());
}
