import { forElements } from "./util.normalizers.js";
import { SVG_LABEL_TAG_NAMES } from "../constants.semantics.js";
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
var normalize_svgs_to_imgs_default = forElements((virtualElement, liveElement, context, settings = {}) => {
  const document = context.document;
  const labelAttributeNames = settings.labelAttributeNames ?? DEFAULT_SETTINGS.labelAttributeNames;
  if (!elementHasTagName(virtualElement, "SVG")) return;
  let labelValue = "";
  for (const svgLabelTagName of SVG_LABEL_TAG_NAMES) {
    labelValue = (virtualElement.querySelector(svgLabelTagName.toLowerCase())?.textContent ?? "").trim();
    if (labelValue) break;
  }
  labelValue ||= resolveLabel(liveElement, document, labelAttributeNames) ?? "";
  replaceElementByImage(virtualElement, document, labelValue);
});
export {
  DEFAULT_SETTINGS,
  normalize_svgs_to_imgs_default as default
};
