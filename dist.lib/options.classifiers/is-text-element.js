const TAG_NAME_SETS_BY_LIST = /* @__PURE__ */ new WeakMap();
const TAG_NAME_SETS_BY_KEY = /* @__PURE__ */ new Map();
const DEFAULT_SETTINGS = Object.freeze({
  tagNames: Object.freeze([
    "ADDRESS",
    "BLOCKQUOTE",
    "B",
    "CODE",
    "EM",
    "FIGURE",
    "FIGCAPTION",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HR",
    "IMG",
    "LI",
    "OL",
    "P",
    "PRE",
    "SMALL",
    "SPAN",
    "STRONG",
    "SUB",
    "SUP",
    "TABLE",
    "TBODY",
    "TD",
    "THEAD",
    "TH",
    "TR",
    "UL"
  ])
});
function resolveTagNameSet(tagNames) {
  let tagNameSet = TAG_NAME_SETS_BY_LIST.get(tagNames);
  if (tagNameSet) return tagNameSet;
  const normalizedTagNames = tagNames.map((tagName) => tagName.toUpperCase());
  const key = normalizedTagNames.join("\n");
  tagNameSet = TAG_NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedTagNames);
  TAG_NAME_SETS_BY_KEY.set(key, tagNameSet);
  TAG_NAME_SETS_BY_LIST.set(tagNames, tagNameSet);
  return tagNameSet;
}
function is_text_element_default(elementNode, settings = {}) {
  return resolveTagNameSet(settings.tagNames ?? DEFAULT_SETTINGS.tagNames).has(elementNode.tagName.toUpperCase());
}
export {
  DEFAULT_SETTINGS,
  is_text_element_default as default
};
