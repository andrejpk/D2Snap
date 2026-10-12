import { ACTIONABLE_ROLE_ATTRIBUTE_VALUES } from "../constants.semantics.js";


export interface IsActionableElementSettings {
	roleAttributeValues: readonly string[];
	tagNames: readonly string[];
}


const NAME_SETS_BY_LIST: WeakMap<readonly string[], Set<string>> = new WeakMap();
const NAME_SETS_BY_KEY: Map<string, Set<string>> = new Map();


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


function resolveNameSet(names: readonly string[], normalize: (name: string) => string): Set<string> {
	let nameSet: Set<string> | undefined = NAME_SETS_BY_LIST.get(names);
	if(nameSet) return nameSet;

	// Equal lists (e.g., created per call) share one set.
	const normalizedNames: string[] = names.map(normalize);
	const key: string = normalizedNames.join("\n");

	nameSet = NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedNames);

	NAME_SETS_BY_KEY.set(key, nameSet);
	NAME_SETS_BY_LIST.set(names, nameSet);

	return nameSet;
}


export default function(elementNode: Element, settings: Partial<IsActionableElementSettings> = {}): boolean {
	const tagNames: Set<string> = resolveNameSet(settings.tagNames ?? DEFAULT_SETTINGS.tagNames, (name: string) => name.toUpperCase());
	const roleAttributeValues: Set<string> = resolveNameSet(settings.roleAttributeValues ?? DEFAULT_SETTINGS.roleAttributeValues, (name: string) => name.toLowerCase());

	return (
		tagNames.has(elementNode.tagName.toUpperCase())
		|| roleAttributeValues.has(
			elementNode.getAttribute("role")?.toLowerCase()
			?? elementNode.role
			?? ""
		)
	);
}