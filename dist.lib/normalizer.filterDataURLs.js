import { NodeType } from "./enums.js";
const DATA_URL_ATTRIBUTE_NAME = "src";
const DATA_URL_ATTRIBUTE_VALUE_REGEX = /^data:/i;
function normalizer_filterDataURLs_default(virtualNode) {
  if (virtualNode.nodeType !== NodeType.ATTRIBUTE_NODE) return;
  const virtualAttr = virtualNode;
  if (virtualAttr.name.toLowerCase() !== DATA_URL_ATTRIBUTE_NAME || !DATA_URL_ATTRIBUTE_VALUE_REGEX.test(virtualAttr.value)) return;
  virtualAttr.ownerElement?.removeAttribute(virtualAttr.name);
}
export {
  normalizer_filterDataURLs_default as default
};
