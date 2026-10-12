import { NodeType } from "../enums.js";
function forElements(normalizer) {
  return (virtualNode, liveNode, context, settings) => {
    if (virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;
    normalizer(virtualNode, liveNode, context, settings);
  };
}
function forAttributes(normalizer) {
  return (virtualNode, liveNode, context, settings) => {
    if (virtualNode.nodeType !== NodeType.ATTRIBUTE_NODE) return;
    normalizer(virtualNode, liveNode, context, settings);
  };
}
function forTexts(normalizer) {
  return (virtualNode, liveNode, context, settings) => {
    if (virtualNode.nodeType !== NodeType.TEXT_NODE) return;
    normalizer(virtualNode, liveNode, context, settings);
  };
}
function forComments(normalizer) {
  return (virtualNode, liveNode, context, settings) => {
    if (virtualNode.nodeType !== NodeType.COMMENT_NODE) return;
    normalizer(virtualNode, liveNode, context, settings);
  };
}
export {
  forAttributes,
  forComments,
  forElements,
  forTexts
};
