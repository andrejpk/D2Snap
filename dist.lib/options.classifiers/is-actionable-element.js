import { ACTIONABLE_ROLE_ATTRIBUTE_VALUES } from "../constants.semantics.js";
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
const normalizeTagName = (name) => name.toUpperCase();
const normalizeRoleAttributeValue = (name) => name.toLowerCase();
const NAME_SETS_BY_NORMALIZER = /* @__PURE__ */ new WeakMap();
const NAME_SETS_BY_KEY = /* @__PURE__ */ new Map();
function resolveNameSet(names, normalize) {
  let nameSetsByList = NAME_SETS_BY_NORMALIZER.get(normalize);
  if (!nameSetsByList) {
    nameSetsByList = /* @__PURE__ */ new WeakMap();
    NAME_SETS_BY_NORMALIZER.set(normalize, nameSetsByList);
  }
  let nameSet = nameSetsByList.get(names);
  if (nameSet) return nameSet;
  const normalizedNames = names.map(normalize);
  const key = normalizedNames.join("\n");
  nameSet = NAME_SETS_BY_KEY.get(key) ?? new Set(normalizedNames);
  NAME_SETS_BY_KEY.set(key, nameSet);
  nameSetsByList.set(names, nameSet);
  return nameSet;
}
function is_actionable_element_default(elementNode, settings = {}) {
  const tagNames = resolveNameSet(settings.tagNames ?? DEFAULT_SETTINGS.tagNames, normalizeTagName);
  const roleAttributeValues = resolveNameSet(settings.roleAttributeValues ?? DEFAULT_SETTINGS.roleAttributeValues, normalizeRoleAttributeValue);
  return tagNames.has(elementNode.tagName.toUpperCase()) || roleAttributeValues.has(
    elementNode.getAttribute("role")?.toLowerCase() ?? elementNode.role ?? ""
  );
}
export {
  DEFAULT_SETTINGS,
  is_actionable_element_default as default
};
