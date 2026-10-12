import { forElements } from "./util.normalizers.js";
const DEFAULT_SETTINGS = Object.freeze({
  tagNames: Object.freeze([
    "CIRCLE",
    "CLIPPATH",
    "DEFS",
    "ELLIPSE",
    "FILTER",
    "G",
    "IMAGE",
    "LINE",
    "LINEARGRADIENT",
    "LINK",
    "MASK",
    "META",
    "NOSCRIPT",
    "PATH",
    "PATTERN",
    "POLYGON",
    "POLYLINE",
    "RADIALGRADIENT",
    "RECT",
    "SCRIPT",
    "STOP",
    "STYLE",
    "TEMPLATE",
    "USE"
  ])
});
const TAG_NAME_SETS_BY_LIST = /* @__PURE__ */ new WeakMap();
const TAG_NAME_SETS_BY_KEY = /* @__PURE__ */ new Map();
function normalizeCaseInsensitive(str) {
  return str.toUpperCase();
}
function normalizeCaseInsensitiveArray(tagNames) {
  return tagNames.map((tagName) => normalizeCaseInsensitive(tagName));
}
function resolveTagNameSet(tagNames) {
  let tagNameSet = TAG_NAME_SETS_BY_LIST.get(tagNames);
  if (tagNameSet) return tagNameSet;
  const normalizedTagNames = normalizeCaseInsensitiveArray(tagNames);
  const key = normalizedTagNames.join("\n");
  tagNameSet = TAG_NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedTagNames);
  TAG_NAME_SETS_BY_KEY.set(key, tagNameSet);
  TAG_NAME_SETS_BY_LIST.set(tagNames, tagNameSet);
  return tagNameSet;
}
var filter_noise_elements_default = forElements((virtualElement, _liveElement, _context, settings = {}) => {
  const tagNames = resolveTagNameSet(settings.tagNames ?? DEFAULT_SETTINGS.tagNames);
  if (tagNames.has(normalizeCaseInsensitive(virtualElement.tagName))) {
    virtualElement.remove();
  }
});
export {
  DEFAULT_SETTINGS,
  filter_noise_elements_default as default
};
