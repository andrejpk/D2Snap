import { NodeType } from "./enums.js";
import { DEFAULT_NORMALIZE_LABEL_ATTRIBUTE_NAMES } from "./var.DEFAULTS_ATTRIBUTES.js";
import { SVG_LABEL_TAG_NAMES } from "./var.SEMANTICS_TAGS.js";
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
    const labelAttributeValue = resolveAttributeAsString(elementNode, labelAttributeName);
    if (!labelAttributeValue) continue;
    if (normalizeCaseInsensitive(labelAttributeName) !== normalizeCaseInsensitive("aria-labelledby")) {
      return labelAttributeValue;
    }
    const referencedText = labelAttributeValue.split(/\s+/).map((id) => resolveIdReferenceText(elementNode, document, id)).filter(Boolean).join(" ");
    if (referencedText) return referencedText;
  }
  return null;
}
function resolveLabel(liveElement, document) {
  return getElementLabelAttribute(liveElement, document, DEFAULT_NORMALIZE_LABEL_ATTRIBUTE_NAMES);
}
function createImage(document, alt = "") {
  const imgSubstituteElementNode = document.createElement("img");
  alt && imgSubstituteElementNode.setAttribute("alt", alt);
  return imgSubstituteElementNode;
}
function replaceElementByImage(elementNode, document, alt = "") {
  const imgSubstituteElementNode = createImage(document, alt);
  elementNode.replaceWith(imgSubstituteElementNode);
  return imgSubstituteElementNode;
}
function normalizer_svgToImg_default(virtualNode, liveNode, document) {
  if (virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;
  const virtualElement = virtualNode;
  const liveElement = liveNode;
  if (!elementHasTagName(virtualElement, "SVG")) return;
  let labelValue = "";
  for (const svgLabelTagName of SVG_LABEL_TAG_NAMES) {
    labelValue = (virtualElement.querySelector(svgLabelTagName.toLowerCase())?.textContent ?? "").trim();
    if (labelValue) break;
  }
  labelValue ||= resolveLabel(liveElement, document) ?? "";
  replaceElementByImage(virtualElement, document, labelValue);
}
export {
  normalizer_svgToImg_default as default
};
