import { NodeType } from "./enums.js";
import { DEFAULT_NORMALIZE_ATTRIBUTE_ICONFONT_VALUES, DEFAULT_NORMALIZE_LABEL_ATTRIBUTE_NAMES } from "./var.DEFAULTS_ATTRIBUTES.js";
import { NON_RENDERED_TAG_NAMES } from "./var.SEMANTICS_TAGS.js";
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
function normalizer_iconClassesToImg_default(virtualNode, liveNode, document, classifiers) {
  if (virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;
  const virtualElement = virtualNode;
  const liveElement = liveNode;
  if (elementHasTagName(virtualElement, "SVG")) return;
  if (elementHasNoTextContent(virtualElement) && virtualElement.children.length === 0) {
    let iconfontsInClass = null;
    for (const className of [...virtualElement.classList].reverse()) {
      const iconfontName = DEFAULT_NORMALIZE_ATTRIBUTE_ICONFONT_VALUES.find((name) => {
        return className.startsWith(`${name}${UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER}`);
      });
      if (!iconfontName) continue;
      iconfontsInClass = className.slice(iconfontName.length + UNIVERSAL_ICONFONT_PREFIX_SUFFIX_DELIMITER.length);
      break;
    }
    if (iconfontsInClass) {
      const alt = resolveLabel(liveElement, document) ?? iconfontsInClass;
      if (!classifiers.actionableElements(liveElement)) {
        replaceElementByImage(virtualElement, document, alt);
      } else {
        virtualElement.prepend(createImage(document, alt));
      }
    }
  }
}
export {
  normalizer_iconClassesToImg_default as default
};
