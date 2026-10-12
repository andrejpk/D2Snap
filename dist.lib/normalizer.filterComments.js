import { NodeType } from "./enums.js";
function normalizer_filterComments_default(virtualNode) {
  if (virtualNode.nodeType !== NodeType.COMMENT_NODE) return;
  virtualNode.parentNode?.removeChild(virtualNode);
}
export {
  normalizer_filterComments_default as default
};
