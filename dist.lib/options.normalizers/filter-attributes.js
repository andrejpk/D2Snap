import { forAttributes } from "./util.normalizers.js";
const ATTRIBUTE_NAME_SETS_BY_LIST = /* @__PURE__ */ new WeakMap();
const ATTRIBUTE_NAME_SETS_BY_KEY = /* @__PURE__ */ new Map();
const DEFAULT_SETTINGS = Object.freeze({
  attributeNames: Object.freeze([])
});
function normalizeCaseInsensitive(str) {
  return str.toUpperCase();
}
function normalizeCaseInsensitiveArray(tagNames) {
  return tagNames.map((tagName) => normalizeCaseInsensitive(tagName));
}
function resolveAttributeNameSet(attributeNames) {
  let attributeNameSet = ATTRIBUTE_NAME_SETS_BY_LIST.get(attributeNames);
  if (attributeNameSet) return attributeNameSet;
  const normalizedAttributeNames = normalizeCaseInsensitiveArray(attributeNames);
  const key = normalizedAttributeNames.join("\n");
  attributeNameSet = ATTRIBUTE_NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedAttributeNames);
  ATTRIBUTE_NAME_SETS_BY_KEY.set(key, attributeNameSet);
  ATTRIBUTE_NAME_SETS_BY_LIST.set(attributeNames, attributeNameSet);
  return attributeNameSet;
}
var filter_attributes_default = forAttributes((virtualAttr, _liveAttr, _context, settings = {}) => {
  const attributeNames = resolveAttributeNameSet(settings.attributeNames ?? DEFAULT_SETTINGS.attributeNames);
  if (attributeNames.has(normalizeCaseInsensitive(virtualAttr.name))) {
    virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
  }
});
export {
  DEFAULT_SETTINGS,
  filter_attributes_default as default
};
