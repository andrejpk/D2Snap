import { type NormalizerContext } from "../types.js";
import { forElements } from "./util.normalizers.js";


export interface FilterNoiseElementsSettings {
	tagNames: readonly string[];
}


export const DEFAULT_SETTINGS: Readonly<FilterNoiseElementsSettings> = Object.freeze({
	tagNames: Object.freeze([
		"CIRCLE",
		"CLIPPATH",
		"DEFS",
		"ELLIPSE",
		"FILTER",
		"G",
		"IMAGE",
		"LINE",
		"LINEARGRADIENT",
		"LINK",
		"MASK",
		"META",
		"NOSCRIPT",
		"PATH",
		"PATTERN",
		"POLYGON",
		"POLYLINE",
		"RADIALGRADIENT",
		"RECT",
		"SCRIPT",
		"STOP",
		"STYLE",
		"TEMPLATE",
		"USE"
	])
});

const TAG_NAME_SETS_BY_LIST: WeakMap<readonly string[], Set<string>> = new WeakMap();
const TAG_NAME_SETS_BY_KEY: Map<string, Set<string>> = new Map();


function normalizeCaseInsensitive(str: string): string {
	return str.toUpperCase();
}

function normalizeCaseInsensitiveArray(tagNames: readonly string[]): string[] {
	return tagNames
		.map((tagName: string) => normalizeCaseInsensitive(tagName));
}

function resolveTagNameSet(tagNames: readonly string[]): Set<string> {
	let tagNameSet: Set<string> | undefined = TAG_NAME_SETS_BY_LIST.get(tagNames);
	if(tagNameSet) return tagNameSet;

	// Equal lists (e.g., created per call) share one set.
	const normalizedTagNames: string[] = normalizeCaseInsensitiveArray(tagNames);
	const key: string = normalizedTagNames.join("\n");

	tagNameSet = TAG_NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedTagNames);

	TAG_NAME_SETS_BY_KEY.set(key, tagNameSet);
	TAG_NAME_SETS_BY_LIST.set(tagNames, tagNameSet);

	return tagNameSet;
}


export default forElements<FilterNoiseElementsSettings>((
	virtualElement: Element,
	_liveElement: Element,
	_context: NormalizerContext,
	settings: Partial<FilterNoiseElementsSettings> = {}
): void => {
	const tagNames: Set<string> = resolveTagNameSet(settings.tagNames ?? DEFAULT_SETTINGS.tagNames);

	if(tagNames.has(normalizeCaseInsensitive(virtualElement.tagName))) {
		virtualElement.remove();
	}
});