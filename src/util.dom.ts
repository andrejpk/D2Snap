import type { DOM, TextNode } from "./types.js";
import { NodeType, NodeFilter } from "./enums.js";
import { isInlineElement, isWhitespacePreservingElement } from "./util.html.js";


export async function ensureDOM(domOrStringOrBuffer: DOM | string | Buffer): Promise<DOM> {
	let domOrString: DOM | string;
	try {
		domOrString = Buffer.isBuffer(domOrStringOrBuffer)
			? domOrStringOrBuffer.toString()
			: domOrStringOrBuffer;
	} catch {
		domOrString = domOrStringOrBuffer as DOM | string;
	}

	if(typeof(domOrString) !== "string") return domOrString;

	const html: string = domOrString.trim();

	if(typeof window !== "undefined") {
		return new DOMParser()
			.parseFromString(html, "text/html");
	}

	try {
		const jsdom = await import("jsdom");

		const virtualConsole = new jsdom.VirtualConsole();

		virtualConsole.on("error", () => {});
		virtualConsole.on("warn", () => {});
		virtualConsole.on("info", () => {});
		virtualConsole.on("log", () => {});

		const dom: DOM = new jsdom.JSDOM(html, {
			runScripts: undefined,
			virtualConsole
		})
			.window
			.document;

		return dom;
	} catch (err) {
		if((err as { code: string; })?.code !== "ERR_MODULE_NOT_FOUND") throw err;

		throw new ReferenceError("Install 'jsdom' to use D2Snap with a non-browser runtime");
	}
}

export function resolveDocument(dom: DOM): Document | null {
	return dom.nodeType === 9
		? dom as Document
		: dom.ownerDocument;
}

export function resolveRoot(node: DOM): Element {
	return (node as Document)?.body ?? (node as Document)?.documentElement ?? node;
}

// Serializes a root as covered by snapshots: the BODY contents for document roots
// (HTML, BODY), the element itself otherwise (snapshots wrap it in a BODY).
export function serializeSnapshotRoot(rootElement: Element): string {
	switch(rootElement.localName.toLowerCase()) {
		case "html":
			return (rootElement.querySelector("body") ?? rootElement).innerHTML;
		case "body":
			return rootElement.innerHTML;
		default:
			return rootElement.outerHTML;
	}
}

function resolveSlottedNodes(node: Node): Node[] {
	// Slots only distribute within shadow trees.
	if(node.nodeName !== "SLOT" || !(node.getRootNode() as ShadowRoot).host) return [ node ];

	const assignedNodes: Node[] = (node as HTMLSlotElement).assignedNodes({ flatten: true });

	return assignedNodes.length
		? assignedNodes
		: [ ...node.childNodes ].flatMap((childNode: Node) => resolveSlottedNodes(childNode));
}

// Child nodes as rendered: (open) shadow root content, slots resolved to the assigned
// light nodes (or fallback content). Unassigned light nodes of a shadow host are skipped.
export function resolveComposedChildNodes(node: Node): Node[] {
	return [ ...((node as Element).shadowRoot ?? node).childNodes ]
		.flatMap((childNode: Node) => resolveSlottedNodes(childNode));
}

// Nodes that took the place of a detached node (between its former siblings).
export function resolveReplacingNodes(
	parentNode: Node | null,
	previousSibling: Node | null,
	nextSibling: Node | null
): Node[] {
	if(!parentNode) return [];
	if(previousSibling && (previousSibling.parentNode !== parentNode)) return [];
	if(nextSibling && (nextSibling.parentNode !== parentNode)) return [];

	const replacingNodes: Node[] = [];

	let currentNode: Node | null = previousSibling
		? previousSibling.nextSibling
		: parentNode.firstChild;

	while(currentNode && (currentNode !== nextSibling)) {
		replacingNodes.push(currentNode);

		currentNode = currentNode.nextSibling;
	}

	return replacingNodes;
}

// Pre-order DFS: parent before child.
// Children are read after the callback, so the latest DOM is traversed.
// Attributes are visited (as nodes) before their element (as in normalization order).
export function traverseDom<T>(
	root: Element,
	filter: number = NodeFilter.SHOW_ALL,
	cb: (node: T) => Node[] | void
) {
	const showElement: boolean = ((filter & NodeFilter.SHOW_ELEMENT) !== 0);
	const showText: boolean = ((filter & NodeFilter.SHOW_TEXT) !== 0);
	const showComment = ((filter & NodeFilter.SHOW_COMMENT) !== 0);
	const showAttribute: boolean = ((filter & NodeFilter.SHOW_ATTRIBUTE) !== 0);

	// Connected root check: 'isConnected' instead of an ancestor walk ('contains').
	// Assumes nodes are not moved out of the root into the same document.
	const isRootConnected: boolean = root.isConnected;
	const isInRoot = (node: Node): boolean => {
		return isRootConnected
			? node.isConnected
			: root.contains(node);
	};

	// Pre-order DFS
	const stack: Node[] = [];

	for(let i = root.childNodes.length - 1; i >= 0; i--) {
		stack.push(root.childNodes[i]);
	}

	while(stack.length) {
		const node: Node = stack.pop()!;

		if(!isInRoot(node)) continue;

		const parentNode: Node | null = node.parentNode;
		const previousSibling: Node | null = node.previousSibling;
		const nextSibling: Node | null = node.nextSibling;

		const passes = (filter === NodeFilter.SHOW_ALL)
            || ((node.nodeType === NodeType.ELEMENT_NODE) && showElement)
            || ((node.nodeType === NodeType.TEXT_NODE) && showText)
            || ((node.nodeType === NodeType.COMMENT_NODE) && showComment);

		if(showAttribute && (node.nodeType === NodeType.ELEMENT_NODE)) {
			for(const attr of [ ...(node as Element).attributes ]) {
				if(!isInRoot(node)) break;
				// Removed by a previous callback
				if(attr.ownerElement !== node) continue;

				cb(attr as T);
			}
		}

		const replacingNodes: Node[] | undefined = (passes && isInRoot(node))
			? (cb(node as T) as Node[] | undefined)
			: undefined;

		// Attached: continue with the latest children.
		// Detached: continue with the returned replacement nodes, else with nodes that replace the original.
		const nextNodes: Node[] = isInRoot(node)
			? [ ...node.childNodes ]
			: (replacingNodes ?? resolveReplacingNodes(parentNode, previousSibling, nextSibling));

		// Insert reversed so the first node is at the top of the stack: pre-order.
		for(let i = nextNodes.length - 1; i >= 0; i--) {
			stack.push(nextNodes[i]);
		}
	}
}

function isWithinWhitespacePreservingElement(element: Element, domRoot: Element): boolean {
	for(let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
		if(isWhitespacePreservingElement(ancestor.tagName)) return true;
		if(ancestor === domRoot) break;
	}

	return false;
}

export function minifyDOM(domRoot: Element): void {
	traverseDom<HTMLElement>(
		domRoot,
		NodeFilter.SHOW_TEXT,
		(textNode: TextNode) => {
			const parent = textNode.parentElement;
			if(!parent) return;

			if(isWithinWhitespacePreservingElement(parent, domRoot)) return;

			const value = textNode.nodeValue ?? "";
			if(!value) return;

			textNode.nodeValue = value.replace(/\s+/g, " ");
		}
	);

	traverseDom<HTMLElement>(
		domRoot,
		NodeFilter.SHOW_TEXT,
		(textNode: TextNode) => {
			const parent = textNode.parentElement;
			if(!parent) return;

			if(isWithinWhitespacePreservingElement(parent, domRoot)) return;

			let value = textNode.nodeValue ?? "";
			if(!value) {
				textNode.parentNode?.removeChild(textNode);

				return;
			}

			const previous = textNode.previousSibling;
			const next = textNode.nextSibling;
			const previousIsText = previous?.nodeType === NodeType.TEXT_NODE;
			const nextIsText = next?.nodeType === NodeType.TEXT_NODE;
			const previousIsElement = previous?.nodeType === NodeType.ELEMENT_NODE;
			const nextIsElement = next?.nodeType === NodeType.ELEMENT_NODE;
			const previousTag = previousIsElement
				? (previous as Element).tagName.toLowerCase()
				: "";
			const nextTag = nextIsElement
				? (next as Element).tagName.toLowerCase()
				: "";
			const previousIsBR = (previousIsElement && previousTag === "br");
			const nextIsBR = (nextIsElement && nextTag === "br");
			const previousIsInline = previousIsText ||
				(
					previousIsElement &&
					isInlineElement(previousTag)
				);
			const nextIsInline = nextIsText ||
				(
					nextIsElement &&
					isInlineElement(nextTag)
				);

			if(value.trim() === "") {
				if(
					previousIsInline &&
					nextIsInline &&
					!previousIsBR &&
					!nextIsBR
				) {
					if(previousIsText) {
						const previousText = previous as TextNode;

						previousText.nodeValue =
							(previousText.nodeValue ?? "").trimEnd();
					}

					if(nextIsText) {
						const nextText = next as TextNode;

						nextText.nodeValue =
							(nextText.nodeValue ?? "").trimStart();
					}

					textNode.nodeValue = " ";

					return;
				}

				textNode.parentNode?.removeChild(textNode);

				return;
			}

			if(previousIsBR) {
				value = value.trimStart();
			}

			if(nextIsBR) {
				value = value.trimEnd();
			}

			if(
				/^\s/.test(value) &&
				previousIsElement &&
				!previousIsInline
			) {
				value = value.trimStart();
			}

			if(/^\s/.test(value) && !previous) {
				value = value.trimStart();
			}

			if(
				/\s$/.test(value) &&
				nextIsElement &&
				!nextIsInline
			) {
				value = value.trimEnd();
			}

			if(/\s$/.test(value) && !next) {
				value = value.trimEnd();
			}

			textNode.nodeValue = value;
		}
	);

	traverseDom<HTMLElement>(
		domRoot,
		NodeFilter.SHOW_TEXT,
		(textNode: TextNode) => {
			if(textNode.nodeValue === "") {
				textNode.parentNode?.removeChild(textNode);
			}
		}
	);
}