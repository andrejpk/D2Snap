import { forElements } from "./util.normalizers.js";
const DEFAULT_SETTINGS = Object.freeze({
  labelAttributeNames: Object.freeze([
    "aria-labelledby",
    "aria-label",
    "title"
  ])
});
function normalizeCaseInsensitive(str) {
  return str.toUpperCase();
}
function elementHasTagName(elementNode, tagName) {
  return normalizeCaseInsensitive(elementNode.tagName) === normalizeCaseInsensitive(tagName);
}
function resolveAttributeAsString(elementNode, attributeName) {
  return (elementNode.getAttribute(attributeName) ?? "").trim();
}
function resolveIdReferenceText(elementNode, document, id) {
  const selector = `[id="${id.replace(/["\\]/g, "\\$&")}"]`;
  const scopes = [elementNode.getRootNode(), document];
  for (const scope of scopes) {
    for (const candidate of scope.querySelectorAll?.(selector) ?? []) {
      const text = (candidate.textContent ?? "").trim();
      if (text) return text;
    }
  }
  return "";
}
function getElementLabelAttribute(elementNode, document, labelAttributeNames) {
  for (const labelAttributeName of labelAttributeNames) {
    const labelAttributeValue = resolveAttributeAsString(elementNode, labelAttributeName.toLowerCase());
    if (!labelAttributeValue) continue;
    if (normalizeCaseInsensitive(labelAttributeName) !== normalizeCaseInsensitive("aria-labelledby")) {
      return labelAttributeValue;
    }
    const referencedText = labelAttributeValue.split(/\s+/).map((id) => resolveIdReferenceText(elementNode, document, id)).filter(Boolean).join(" ");
    if (referencedText) return referencedText;
  }
  return null;
}
function resolveLabel(liveElement, document, labelAttributeNames) {
  return getElementLabelAttribute(liveElement, document, labelAttributeNames);
}
var filter_empty_images_default = forElements((virtualElement, liveElement, context, settings = {}) => {
  const document = context.document;
  const labelAttributeNames = settings.labelAttributeNames ?? DEFAULT_SETTINGS.labelAttributeNames;
  if (elementHasTagName(virtualElement, "IMG") && !resolveLabel(liveElement, document, labelAttributeNames)) {
    if (!resolveAttributeAsString(virtualElement, "src") && !resolveAttributeAsString(virtualElement, "alt")) {
      virtualElement.remove();
    }
  }
});
export {
  DEFAULT_SETTINGS,
  filter_empty_images_default as default
};
