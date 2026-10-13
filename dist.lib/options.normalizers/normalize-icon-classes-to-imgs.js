import { NodeType } from "../enums.js";
import { forElements } from "./util.normalizers.js";
import { NON_RENDERED_TAG_NAMES } from "../constants.semantics.js";
const DEFAULT_SETTINGS = Object.freeze({
  iconClassPrefixes: Object.freeze([]),
  labelAttributeNames: Object.freeze([
    "aria-labelledby",
    "aria-label",
    "title"
  ])
});
const UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER = "-";
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
  return !hasRenderedText(elementNode) && ![...elementNode.getElementsByTagName("img")].some((image) => !!resolveAttributeAsString(image, "alt"));
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
var normalize_icon_classes_to_imgs_default = forElements((virtualElement, liveElement, context, settings = {}) => {
  const document = context.document;
  const labelAttributeNames = settings.labelAttributeNames ?? DEFAULT_SETTINGS.labelAttributeNames;
  const iconClassPrefixes = settings.iconClassPrefixes ?? DEFAULT_SETTINGS.iconClassPrefixes;
  if (elementHasTagName(virtualElement, "SVG")) return;
  if (virtualElement.children.length === 0 && elementHasNoTextContent(virtualElement)) {
    let iconfontsInClass = null;
    for (const className of [...virtualElement.classList].reverse()) {
      const iconfontName = iconClassPrefixes.find((name) => {
        return className.startsWith(`${name}${UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER}`);
      });
      if (!iconfontName) continue;
      iconfontsInClass = className.slice(iconfontName.length + UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER.length);
      break;
    }
    if (iconfontsInClass) {
      const alt = resolveLabel(liveElement, document, labelAttributeNames) ?? iconfontsInClass;
      if (!context.classifiers.actionableElement(liveElement)) {
        replaceElementByImage(virtualElement, document, alt);
      } else {
        virtualElement.prepend(createImage(document, alt));
      }
    }
  }
});
export {
  DEFAULT_SETTINGS,
  normalize_icon_classes_to_imgs_default as default
};
