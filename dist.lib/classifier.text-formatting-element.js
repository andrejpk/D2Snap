import { DEFAULT_CLASS_TEXT_TAG_NAMES } from "./var.DEFAULTS_TAGS.js";
const TEXT_ELEMENT_TAG_NAMES = new Set(
  DEFAULT_CLASS_TEXT_TAG_NAMES.map((t) => t.toUpperCase())
);
function classifier_text_formatting_element_default(elementNode) {
  return TEXT_ELEMENT_TAG_NAMES.has(elementNode.tagName.toUpperCase());
}
export {
  classifier_text_formatting_element_default as default
};
