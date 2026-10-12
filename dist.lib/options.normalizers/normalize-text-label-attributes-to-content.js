import { NodeType } from "../enums.js";
import { isRawTextElement, isVoidElement } from "../util.html.js";
import { forElements } from "./util.normalizers.js";
import { NON_RENDERED_TAG_NAMES } from "../constants.semantics.js";
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
function hasRenderedText(node) {
  for (const child of node.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      if ((child.nodeValue ?? "").trim()) return true;
      continue;
    }
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    if (NON_RENDERED_TAG_NAMES.has(normalizeCaseInsensitive(child.tagName))) continue;
    if (hasRenderedText(child)) return true;
  }
  return false;
}
function elementHasNoTextContent(elementNode) {
  return !hasRenderedText(elementNode) && ![...elementNode.querySelectorAll("img[alt]")].some((image) => !!resolveAttributeAsString(image, "alt"));
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
var normalize_text_label_attributes_to_content_default = forElements((virtualElement, liveElement, context, settings = {}) => {
  const document = context.document;
  const labelAttributeNames = settings.labelAttributeNames ?? DEFAULT_SETTINGS.labelAttributeNames;
  if (!isRawTextElement(virtualElement.tagName)) {
    const labelAttributeValue = resolveLabel(liveElement, document, labelAttributeNames);
    if (labelAttributeValue) {
      if (elementHasTagName(virtualElement, "IMG")) {
        const altAttributeValue = resolveAttributeAsString(virtualElement, "alt");
        !altAttributeValue && virtualElement.setAttribute("alt", labelAttributeValue);
      } else if (!isVoidElement(virtualElement.tagName)) {
        elementHasNoTextContent(virtualElement) && virtualElement.prepend(labelAttributeValue);
      }
    }
  }
});
export {
  DEFAULT_SETTINGS,
  normalize_text_label_attributes_to_content_default as default
};
