import { ACTIONABLE_ROLE_ATTRIBUTE_VALUES } from "../constants.semantics.js";


export interface IsActionableElementSettings {
	roleAttributeValues: readonly string[];
	tagNames: readonly string[];
}


export const DEFAULT_SETTINGS: Readonly<IsActionableElementSettings> = Object.freeze({
	roleAttributeValues: Object.freeze([ ...ACTIONABLE_ROLE_ATTRIBUTE_VALUES ]),
	tagNames: Object.freeze([
		"A",
		"BUTTON",
		"DETAILS",
		"FORM",
		"INPUT",
		"LABEL",
		"SELECT",
		"OPTION",
		"SUMMARY",
		"TEXTAREA"
	])
});

type NameNormalizerFn = (name: string) => string;

// Stable normalizers (identity caches are kept per normalizer)
const normalizeTagName: NameNormalizerFn = (name: string) => name.toUpperCase();
const normalizeRoleAttributeValue: NameNormalizerFn = (name: string) => name.toLowerCase();

// Per normalizer, by list identity: one list may be passed for differently normalized settings.
const NAME_SETS_BY_NORMALIZER: WeakMap<NameNormalizerFn, WeakMap<readonly string[], Set<string>>> = new WeakMap();
// By normalized content (the key distinguishes normalization modes).
const NAME_SETS_BY_KEY: Map<string, Set<string>> = new Map();


function resolveNameSet(names: readonly string[], normalize: NameNormalizerFn): Set<string> {
	let nameSetsByList: WeakMap<readonly string[], Set<string>> | undefined = NAME_SETS_BY_NORMALIZER.get(normalize);
	if(!nameSetsByList) {
		nameSetsByList = new WeakMap();

		NAME_SETS_BY_NORMALIZER.set(normalize, nameSetsByList);
	}

	let nameSet: Set<string> | undefined = nameSetsByList.get(names);
	if(nameSet) return nameSet;

	// Equal lists (e.g., created per call) share one set.
	const normalizedNames: string[] = names.map(normalize);
	const key: string = normalizedNames.join("\n");

	nameSet = NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedNames);

	NAME_SETS_BY_KEY.set(key, nameSet);
	nameSetsByList.set(names, nameSet);

	return nameSet;
}


export default function(elementNode: Element, settings: Partial<IsActionableElementSettings> = {}): boolean {
	const tagNames: Set<string> = resolveNameSet(settings.tagNames ?? DEFAULT_SETTINGS.tagNames, normalizeTagName);
	const roleAttributeValues: Set<string> = resolveNameSet(settings.roleAttributeValues ?? DEFAULT_SETTINGS.roleAttributeValues, normalizeRoleAttributeValue);

	return (
		tagNames.has(elementNode.tagName.toUpperCase())
		|| roleAttributeValues.has(
			elementNode.getAttribute("role")?.toLowerCase()
			?? elementNode.role
			?? ""
		)
	);
}
