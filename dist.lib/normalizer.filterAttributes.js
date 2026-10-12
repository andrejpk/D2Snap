import { NodeType } from "./enums.js";
import { DEFAULT_FILTER_ATTRIBUTE_NAMES } from "./var.DEFAULTS_ATTRIBUTES.js";
const FILTER_ATTRIBUTES_NAMES = new Set(normalizeCaseInsensitiveArray(DEFAULT_FILTER_ATTRIBUTE_NAMES));
function normalizeCaseInsensitive(str) {
  return str.toUpperCase();
}
function normalizeCaseInsensitiveArray(tagNames) {
  return tagNames.map((tagName) => normalizeCaseInsensitive(tagName));
}
function normalizer_filterAttributes_default(virtualNode) {
  if (virtualNode.nodeType !== NodeType.ATTRIBUTE_NODE) return;
  const virtualAttr = virtualNode;
  if (FILTER_ATTRIBUTES_NAMES.has(normalizeCaseInsensitive(virtualAttr.name))) {
    virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
  }
}
export {
  normalizer_filterAttributes_default as default
};
