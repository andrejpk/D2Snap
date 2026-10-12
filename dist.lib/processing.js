import { NodeType, NodeFilter } from "./enums.js";
import { minifyDOM, resolveComposedChildNodes, resolveReplacingNodes, traverseDom } from "./util.dom.js";
import { formatHTML, isVoidElement } from "./util.html.js";
function hasSlotChildNode(virtualNode) {
  return !!virtualNode.querySelector?.(":scope > slot");
}
function composeAndMapChildNodes(virtualNode, liveNode, liveByVirtual, document, shadowDOM) {
  if (shadowDOM && (liveNode.shadowRoot || hasSlotChildNode(virtualNode))) {
    const liveChildNodes2 = resolveComposedChildNodes(liveNode);
    const virtualChildNodes2 = liveChildNodes2.map((liveChildNode) => document.importNode(liveChildNode, true));
    virtualNode.replaceChildren(...virtualChildNodes2);
    for (let i = 0; i < virtualChildNodes2.length; i++) {
      liveByVirtual.set(virtualChildNodes2[i], liveChildNodes2[i]);
    }
    return;
  }
  const virtualChildNodes = virtualNode.childNodes;
  const liveChildNodes = liveNode.childNodes;
  for (let i = 0; i < Math.min(virtualChildNodes.length, liveChildNodes.length); i++) {
    if (virtualChildNodes[i].nodeName !== liveChildNodes[i].nodeName) continue;
    liveByVirtual.set(virtualChildNodes[i], liveChildNodes[i]);
  }
}
function resolveLiveNode(virtualNode, liveByVirtual, inheritedLiveByVirtual) {
  const resolve = (node) => {
    return liveByVirtual.get(node) ?? inheritedLiveByVirtual.get(node);
  };
  if (virtualNode.nodeType !== NodeType.ATTRIBUTE_NODE) return resolve(virtualNode) ?? virtualNode;
  const virtualAttr = virtualNode;
  const liveElement = virtualAttr.ownerElement ? resolve(virtualAttr.ownerElement) : void 0;
  return liveElement?.getAttributeNodeNS(virtualAttr.namespaceURI, virtualAttr.localName) ?? virtualAttr;
}
function applyNormalizers(normalizers, virtualNode, liveNode, inheritedLiveByVirtual, context) {
  for (const normalizer of normalizers) {
    const parentNode = virtualNode.parentNode;
    const previousSibling = virtualNode.previousSibling;
    const nextSibling = virtualNode.nextSibling;
    const ownerElement = virtualNode.ownerElement ?? null;
    normalizer(virtualNode, liveNode, context);
    const isAttached = virtualNode.nodeType === NodeType.ATTRIBUTE_NODE ? virtualNode.ownerElement === ownerElement : virtualNode.parentNode === parentNode;
    if (isAttached) continue;
    for (const replacingNode of resolveReplacingNodes(parentNode, previousSibling, nextSibling)) {
      replacingNode.nodeType === liveNode.nodeType && inheritedLiveByVirtual.set(replacingNode, liveNode);
    }
    return;
  }
}
function preProcessDOM(virtualDomRoot, liveDomRoot, document, options) {
  const normalizers = options.normalizers;
  const context = {
    classifiers: options.classifiers,
    document
  };
  const liveByVirtual = /* @__PURE__ */ new Map();
  const inheritedLiveByVirtual = /* @__PURE__ */ new Map();
  const virtualDomRootEquivalent = virtualDomRoot.tagName === liveDomRoot.tagName ? virtualDomRoot : virtualDomRoot.firstElementChild ?? virtualDomRoot;
  liveByVirtual.set(virtualDomRootEquivalent, liveDomRoot);
  virtualDomRootEquivalent === virtualDomRoot && composeAndMapChildNodes(virtualDomRoot, liveDomRoot, liveByVirtual, document, options.shadowDOM);
  traverseDom(
    virtualDomRoot,
    NodeFilter.SHOW_ALL,
    (node) => {
      const pairedLiveNode = liveByVirtual.get(node);
      pairedLiveNode && node.nodeType === NodeType.ELEMENT_NODE && composeAndMapChildNodes(node, pairedLiveNode, liveByVirtual, document, options.shadowDOM);
      applyNormalizers(
        normalizers,
        node,
        resolveLiveNode(node, liveByVirtual, inheritedLiveByVirtual),
        inheritedLiveByVirtual,
        context
      );
    }
  );
}
function postProcessDOM(domRoot, options, isActionableElement) {
  if (options.filterEmptyElements) {
    const elementNodes = [...domRoot.getElementsByTagName("*")];
    for (let i = elementNodes.length - 1; i >= 0; i--) {
      const elementNode = elementNodes[i];
      if (isActionableElement(elementNode)) continue;
      if (isVoidElement(elementNode.tagName)) continue;
      if (elementNode.children.length || (elementNode.textContent ?? "").trim().length) continue;
      elementNode.remove();
    }
  }
  if (options.minify) {
    minifyDOM(domRoot);
  }
}
function postProcessHTML(html, options) {
  const optionsWithDefaults = {
    debug: false,
    ...options
  };
  let processedHTML = html;
  if (optionsWithDefaults.debug) {
    processedHTML = formatHTML(processedHTML);
  }
  return processedHTML;
}
export {
  postProcessDOM,
  postProcessHTML,
  preProcessDOM
};
