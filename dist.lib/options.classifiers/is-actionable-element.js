import { ACTIONABLE_ROLE_ATTRIBUTE_VALUES } from "../constants.semantics.js";
const NAME_SETS_BY_LIST = /* @__PURE__ */ new WeakMap();
const NAME_SETS_BY_KEY = /* @__PURE__ */ new Map();
const DEFAULT_SETTINGS = Object.freeze({
  roleAttributeValues: Object.freeze([...ACTIONABLE_ROLE_ATTRIBUTE_VALUES]),
  tagNames: Object.freeze([
    "A",
    "BUTTON",
    "DETAILS",
    "FORM",
    "INPUT",
    "LABEL",
    "SELECT",
    "OPTION",
    "SUMMARY",
    "TEXTAREA"
  ])
});
function resolveNameSet(names, normalize) {
  let nameSet = NAME_SETS_BY_LIST.get(names);
  if (nameSet) return nameSet;
  const normalizedNames = names.map(normalize);
  const key = normalizedNames.join("\n");
  nameSet = NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedNames);
  NAME_SETS_BY_KEY.set(key, nameSet);
  NAME_SETS_BY_LIST.set(names, nameSet);
  return nameSet;
}
function is_actionable_element_default(elementNode, settings = {}) {
  const tagNames = resolveNameSet(settings.tagNames ?? DEFAULT_SETTINGS.tagNames, (name) => name.toUpperCase());
  const roleAttributeValues = resolveNameSet(settings.roleAttributeValues ?? DEFAULT_SETTINGS.roleAttributeValues, (name) => name.toLowerCase());
  return tagNames.has(elementNode.tagName.toUpperCase()) || roleAttributeValues.has(
    elementNode.getAttribute("role")?.toLowerCase() ?? elementNode.role ?? ""
  );
}
export {
  DEFAULT_SETTINGS,
  is_actionable_element_default as default
};
