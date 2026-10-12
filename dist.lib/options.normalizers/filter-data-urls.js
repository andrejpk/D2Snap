import { forAttributes } from "./util.normalizers.js";
const DEFAULT_SETTINGS = Object.freeze({
  attributeNames: Object.freeze(["src"]),
  valuePattern: /^data:/i
});
var filter_data_urls_default = forAttributes((virtualAttr, _liveAttr, _context, settings = {}) => {
  const attributeNames = settings.attributeNames ?? DEFAULT_SETTINGS.attributeNames;
  const valuePattern = settings.valuePattern ?? DEFAULT_SETTINGS.valuePattern;
  if (!attributeNames.some((attributeName) => attributeName.toLowerCase() === virtualAttr.name.toLowerCase()) || !valuePattern.test(virtualAttr.value)) return;
  virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
});
export {
  DEFAULT_SETTINGS,
  filter_data_urls_default as default
};
