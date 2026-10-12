import { isInlineElement, isVoidElement } from "../util.html.js";
import { forElements } from "./util.normalizers.js";
import { CONFIG } from "../config.js";
const DEFAULT_SETTINGS = Object.freeze({
  attributeName: CONFIG.uniqueAttributeName
});
const NEXT_UNIQUE_IDS = /* @__PURE__ */ new WeakMap();
function resolveAttributeAsString(elementNode, attributeName) {
  return (elementNode.getAttribute(attributeName) ?? "").trim();
}
function resolveNextUniqueID(liveDocument, attributeName) {
  !NEXT_UNIQUE_IDS.has(liveDocument) && NEXT_UNIQUE_IDS.set(liveDocument, /* @__PURE__ */ new Map());
  const nextUniqueIDs = NEXT_UNIQUE_IDS.get(liveDocument);
  if (!nextUniqueIDs.has(attributeName)) {
    const maxUniqueID = [...liveDocument.querySelectorAll(`[${attributeName}]`)].reduce((max, elementNode) => {
      return Math.max(max, parseInt(resolveAttributeAsString(elementNode, attributeName)) || 0);
    }, -1);
    nextUniqueIDs.set(attributeName, maxUniqueID + 1);
  }
  const uniqueID = nextUniqueIDs.get(attributeName);
  nextUniqueIDs.set(attributeName, uniqueID + 1);
  return uniqueID;
}
var assign_unique_ids_default = forElements((virtualElement, liveElement, _context, settings = {}) => {
  const attributeName = settings.attributeName ?? DEFAULT_SETTINGS.attributeName;
  if (liveElement === virtualElement) return;
  if (isInlineElement(liveElement.tagName) && isVoidElement(liveElement.tagName)) return;
  let uniqueID = resolveAttributeAsString(liveElement, attributeName);
  if (!uniqueID) {
    uniqueID = resolveNextUniqueID(liveElement.ownerDocument, attributeName).toString();
    liveElement.setAttribute(attributeName, uniqueID);
  }
  virtualElement.setAttribute(attributeName, uniqueID);
});
export {
  DEFAULT_SETTINGS,
  assign_unique_ids_default as default
};
