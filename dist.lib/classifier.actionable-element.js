import { DEFAULT_CLASS_ACTIONABLE_TAG_NAMES } from "./var.DEFAULTS_TAGS.js";
import { ACTIONABLE_ROLE_ATTRIBUTE_VALUES as ACTIONABLE_ROLE_ATTRIBUTE_VALUES_ARRAY } from "./var.SEMANTICS_ATTRIBUTES.js";
const ACTIONABLE_ELEMENT_TAG_NAMES = new Set(
  DEFAULT_CLASS_ACTIONABLE_TAG_NAMES.map((t) => t.toUpperCase())
);
const ACTIONABLE_ROLE_ATTRIBUTE_VALUES = new Set(
  ACTIONABLE_ROLE_ATTRIBUTE_VALUES_ARRAY.map((t) => t.toLowerCase())
);
function classifier_actionable_element_default(elementNode) {
  return ACTIONABLE_ELEMENT_TAG_NAMES.has(elementNode.tagName.toUpperCase()) || ACTIONABLE_ROLE_ATTRIBUTE_VALUES.has(
    elementNode.getAttribute("role")?.toLowerCase() ?? elementNode.role ?? ""
  );
}
export {
  classifier_actionable_element_default as default
};
