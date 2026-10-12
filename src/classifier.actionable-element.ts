import { DEFAULT_CLASS_ACTIONABLE_TAG_NAMES } from "./var.DEFAULTS_TAGS.js";
import { ACTIONABLE_ROLE_ATTRIBUTE_VALUES as ACTIONABLE_ROLE_ATTRIBUTE_VALUES_ARRAY } from "./var.SEMANTICS_ATTRIBUTES.js";


const ACTIONABLE_ELEMENT_TAG_NAMES: Set<string> = new Set(
	DEFAULT_CLASS_ACTIONABLE_TAG_NAMES.map(t => t.toUpperCase())
);
const ACTIONABLE_ROLE_ATTRIBUTE_VALUES: Set<string> = new Set(
	ACTIONABLE_ROLE_ATTRIBUTE_VALUES_ARRAY.map(t => t.toLowerCase())
);


export default function(elementNode: Element): boolean {
	return (
		ACTIONABLE_ELEMENT_TAG_NAMES.has(elementNode.tagName.toUpperCase())
		|| ACTIONABLE_ROLE_ATTRIBUTE_VALUES.has(
			elementNode.getAttribute("role")?.toLowerCase()
			?? elementNode.role
			?? ""
		)
	);
}