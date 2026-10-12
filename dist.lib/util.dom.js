import { NodeType, NodeFilter } from "./enums.js";
import { isInlineElement, isWhitespacePreservingElement } from "./util.html.js";
async function ensureDOM(domOrStringOrBuffer) {
  let domOrString;
  try {
    domOrString = Buffer.isBuffer(domOrStringOrBuffer) ? domOrStringOrBuffer.toString() : domOrStringOrBuffer;
  } catch {
    domOrString = domOrStringOrBuffer;
  }
  if (typeof domOrString !== "string") return domOrString;
  const html = domOrString.trim();
  if (typeof window !== "undefined") {
    return new DOMParser().parseFromString(html, "text/html");
  }
  try {
    const jsdom = await import("jsdom");
    const virtualConsole = new jsdom.VirtualConsole();
    virtualConsole.on("error", () => {
    });
    virtualConsole.on("warn", () => {
    });
    virtualConsole.on("info", () => {
    });
    virtualConsole.on("log", () => {
    });
    const dom = new jsdom.JSDOM(html, {
      runScripts: void 0,
      virtualConsole
    }).window.document;
    return dom;
  } catch (err) {
    if (err?.code !== "ERR_MODULE_NOT_FOUND") throw err;
    throw new ReferenceError("Install 'jsdom' to use D2Snap with a non-browser runtime");
  }
}
function resolveDocument(dom) {
  return dom.nodeType === 9 ? dom : dom.ownerDocument;
}
function resolveRoot(node) {
  return node?.body ?? node?.documentElement ?? node;
}
function serializeSnapshotRoot(rootElement) {
  switch (rootElement.localName.toLowerCase()) {
    case "html":
      return (rootElement.querySelector("body") ?? rootElement).innerHTML;
    case "body":
      return rootElement.innerHTML;
    default:
      return rootElement.outerHTML;
  }
}
function resolveSlottedNodes(node) {
  if (node.nodeName !== "SLOT" || !node.getRootNode().host) return [node];
  const assignedNodes = node.assignedNodes({ flatten: true });
  return assignedNodes.length ? assignedNodes : [...node.childNodes].flatMap((childNode) => resolveSlottedNodes(childNode));
}
function resolveComposedChildNodes(node) {
  return [...(node.shadowRoot ?? node).childNodes].flatMap((childNode) => resolveSlottedNodes(childNode));
}
function resolveReplacingNodes(parentNode, previousSibling, nextSibling) {
  if (!parentNode) return [];
  if (previousSibling && previousSibling.parentNode !== parentNode) return [];
  if (nextSibling && nextSibling.parentNode !== parentNode) return [];
  const replacingNodes = [];
  let currentNode = previousSibling ? previousSibling.nextSibling : parentNode.firstChild;
  while (currentNode && currentNode !== nextSibling) {
    replacingNodes.push(currentNode);
    currentNode = currentNode.nextSibling;
  }
  return replacingNodes;
}
function traverseDom(root, filter = NodeFilter.SHOW_ALL, cb) {
  const showElement = (filter & NodeFilter.SHOW_ELEMENT) !== 0;
  const showText = (filter & NodeFilter.SHOW_TEXT) !== 0;
  const showComment = (filter & NodeFilter.SHOW_COMMENT) !== 0;
  const showAttribute = (filter & NodeFilter.SHOW_ATTRIBUTE) !== 0;
  const isRootConnected = root.isConnected;
  const isInRoot = (node) => {
    return isRootConnected ? node.isConnected : root.contains(node);
  };
  const stack = [];
  for (let i = root.childNodes.length - 1; i >= 0; i--) {
    stack.push(root.childNodes[i]);
  }
  while (stack.length) {
    const node = stack.pop();
    if (!isInRoot(node)) continue;
    const parentNode = node.parentNode;
    const previousSibling = node.previousSibling;
    const nextSibling = node.nextSibling;
    const passes = filter === NodeFilter.SHOW_ALL || node.nodeType === NodeType.ELEMENT_NODE && showElement || node.nodeType === NodeType.TEXT_NODE && showText || node.nodeType === NodeType.COMMENT_NODE && showComment;
    if (showAttribute && node.nodeType === NodeType.ELEMENT_NODE) {
      for (const attr of [...node.attributes]) {
        if (!isInRoot(node)) break;
        if (attr.ownerElement !== node) continue;
        cb(attr);
      }
    }
    const replacingNodes = passes && isInRoot(node) ? cb(node) : void 0;
    const nextNodes = isInRoot(node) ? [...node.childNodes] : replacingNodes ?? resolveReplacingNodes(parentNode, previousSibling, nextSibling);
    for (let i = nextNodes.length - 1; i >= 0; i--) {
      stack.push(nextNodes[i]);
    }
  }
}
function isWithinWhitespacePreservingElement(element, domRoot) {
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    if (isWhitespacePreservingElement(ancestor.tagName)) return true;
    if (ancestor === domRoot) break;
  }
  return false;
}
function minifyDOM(domRoot) {
  traverseDom(
    domRoot,
    NodeFilter.SHOW_TEXT,
    (textNode) => {
      const parent = textNode.parentElement;
      if (!parent) return;
      if (isWithinWhitespacePreservingElement(parent, domRoot)) return;
      const value = textNode.nodeValue ?? "";
      if (!value) return;
      textNode.nodeValue = value.replace(/\s+/g, " ");
    }
  );
  traverseDom(
    domRoot,
    NodeFilter.SHOW_TEXT,
    (textNode) => {
      const parent = textNode.parentElement;
      if (!parent) return;
      if (isWithinWhitespacePreservingElement(parent, domRoot)) return;
      let value = textNode.nodeValue ?? "";
      if (!value) {
        textNode.parentNode?.removeChild(textNode);
        return;
      }
      const previous = textNode.previousSibling;
      const next = textNode.nextSibling;
      const previousIsText = previous?.nodeType === NodeType.TEXT_NODE;
      const nextIsText = next?.nodeType === NodeType.TEXT_NODE;
      const previousIsElement = previous?.nodeType === NodeType.ELEMENT_NODE;
      const nextIsElement = next?.nodeType === NodeType.ELEMENT_NODE;
      const previousTag = previousIsElement ? previous.tagName.toLowerCase() : "";
      const nextTag = nextIsElement ? next.tagName.toLowerCase() : "";
      const previousIsBR = previousIsElement && previousTag === "br";
      const nextIsBR = nextIsElement && nextTag === "br";
      const previousIsInline = previousIsText || previousIsElement && isInlineElement(previousTag);
      const nextIsInline = nextIsText || nextIsElement && isInlineElement(nextTag);
      if (value.trim() === "") {
        if (previousIsInline && nextIsInline && !previousIsBR && !nextIsBR) {
          if (previousIsText) {
            const previousText = previous;
            previousText.nodeValue = (previousText.nodeValue ?? "").trimEnd();
          }
          if (nextIsText) {
            const nextText = next;
            nextText.nodeValue = (nextText.nodeValue ?? "").trimStart();
          }
          textNode.nodeValue = " ";
          return;
        }
        textNode.parentNode?.removeChild(textNode);
        return;
      }
      if (previousIsBR) {
        value = value.trimStart();
      }
      if (nextIsBR) {
        value = value.trimEnd();
      }
      if (/^\s/.test(value) && previousIsElement && !previousIsInline) {
        value = value.trimStart();
      }
      if (/^\s/.test(value) && !previous) {
        value = value.trimStart();
      }
      if (/\s$/.test(value) && nextIsElement && !nextIsInline) {
        value = value.trimEnd();
      }
      if (/\s$/.test(value) && !next) {
        value = value.trimEnd();
      }
      textNode.nodeValue = value;
    }
  );
  traverseDom(
    domRoot,
    NodeFilter.SHOW_TEXT,
    (textNode) => {
      if (textNode.nodeValue === "") {
        textNode.parentNode?.removeChild(textNode);
      }
    }
  );
}
export {
  ensureDOM,
  minifyDOM,
  resolveComposedChildNodes,
  resolveDocument,
  resolveReplacingNodes,
  resolveRoot,
  serializeSnapshotRoot,
  traverseDom
};
