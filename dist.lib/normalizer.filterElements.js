import { NodeType } from "./enums.js";
import { DEFAULT_FILTER_TAG_NAMES } from "./var.DEFAULTS_TAGS.js";
const FILTER_ELEMENTS_TAG_NAMES = new Set(normalizeCaseInsensitiveArray(DEFAULT_FILTER_TAG_NAMES));
function normalizeCaseInsensitive(str) {
  return str.toUpperCase();
}
function normalizeCaseInsensitiveArray(tagNames) {
  return tagNames.map((tagName) => normalizeCaseInsensitive(tagName));
}
function normalizer_filterElements_default(virtualNode) {
  if (virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;
  const virtualElement = virtualNode;
  if (FILTER_ELEMENTS_TAG_NAMES.has(normalizeCaseInsensitive(virtualElement.tagName))) {
    virtualElement.remove();
  }
}
export {
  normalizer_filterElements_default as default
};
