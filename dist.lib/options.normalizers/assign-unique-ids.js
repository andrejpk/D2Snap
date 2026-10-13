import { isInlineElement, isVoidElement } from "../util.html.js";
import { forElements } from "./util.normalizers.js";
import { CONFIG } from "../config.js";
const DEFAULT_SETTINGS = Object.freeze({
  attributeName: CONFIG.uniqueAttributeName
});
const NEXT_UNIQUE_IDS = /* @__PURE__ */ new WeakMap();
const OCCUPIED_UNIQUE_IDS = /* @__PURE__ */ new WeakMap();
function resolveAttributeAsString(elementNode, attributeName) {
  return (elementNode.getAttribute(attributeName) ?? "").trim();
}
function resolveMap(map, key) {
  !map.has(key) && map.set(key, /* @__PURE__ */ new Map());
  return map.get(key);
}
function allocateUniqueID(liveDocument, virtualDocument, attributeName) {
  const occupiedUniqueIDsByAttribute = resolveMap(OCCUPIED_UNIQUE_IDS, virtualDocument);
  if (!occupiedUniqueIDsByAttribute.has(attributeName)) {
    occupiedUniqueIDsByAttribute.set(attributeName, new Set(
      [...liveDocument.querySelectorAll(`[${attributeName}]`)].map((elementNode) => resolveAttributeAsString(elementNode, attributeName))
    ));
  }
  const occupiedUniqueIDs = occupiedUniqueIDsByAttribute.get(attributeName);
  const nextUniqueIDs = resolveMap(NEXT_UNIQUE_IDS, liveDocument);
  let uniqueID = nextUniqueIDs.get(attributeName) ?? [...occupiedUniqueIDs].reduce((max, id) => Math.max(max, parseInt(id) || 0), -1) + 1;
  while (occupiedUniqueIDs.has(uniqueID.toString())) uniqueID++;
  occupiedUniqueIDs.add(uniqueID.toString());
  nextUniqueIDs.set(attributeName, uniqueID + 1);
  return uniqueID.toString();
}
var assign_unique_ids_default = forElements((virtualElement, liveElement, context, settings = {}) => {
  const attributeName = settings.attributeName ?? DEFAULT_SETTINGS.attributeName;
  if (liveElement === virtualElement) return;
  if (isInlineElement(liveElement.tagName) && isVoidElement(liveElement.tagName)) return;
  let uniqueID = resolveAttributeAsString(liveElement, attributeName);
  if (!uniqueID) {
    uniqueID = allocateUniqueID(liveElement.ownerDocument, context.document, attributeName);
    liveElement.setAttribute(attributeName, uniqueID);
  }
  virtualElement.setAttribute(attributeName, uniqueID);
});
export {
  DEFAULT_SETTINGS,
  assign_unique_ids_default as default
};
