import { type D2SnapOptions, type NodeNormalizerFn, type NormalizerContext } from "./types.js";
import { NodeType, NodeFilter } from "./enums.js";
import { minifyDOM, resolveComposedChildNodes, resolveReplacingNodes, traverseDom } from "./util.dom.js";
import { formatHTML, isVoidElement } from "./util.html.js";


type DOMPreProcessingOptions = Pick<D2SnapOptions, "classifiers" | "normalizers" | "shadowDOM">;

interface DOMPostProcessingOptions {
	filterEmptyElements: boolean;
	minify: boolean;
}

interface HTMLPostProcessingOptions {
	debug: boolean;
}


function hasSlotChildNode(virtualNode: Node): boolean {
	return !!(virtualNode as Element).querySelector?.(":scope > slot");
}

function composeAndMapChildNodes(
	virtualNode: Node,
	liveNode: Node,
	liveByVirtual: Map<Node, Node>,
	document: Document,
	shadowDOM: boolean
): void {
	// Shadow host or slot parent: replace with the composed (rendered) children.
	if(shadowDOM && ((liveNode as Element).shadowRoot || hasSlotChildNode(virtualNode))) {
		const liveChildNodes: Node[] = resolveComposedChildNodes(liveNode);
		const virtualChildNodes: Node[] = liveChildNodes
			.map((liveChildNode: Node) => document.importNode(liveChildNode, true));

		(virtualNode as Element).replaceChildren(...virtualChildNodes);

		for(let i = 0; i < virtualChildNodes.length; i++) {
			liveByVirtual.set(virtualChildNodes[i], liveChildNodes[i]);
		}

		return;
	}

	const virtualChildNodes: NodeListOf<ChildNode> = virtualNode.childNodes;
	const liveChildNodes: NodeListOf<ChildNode> = liveNode.childNodes;

	for(let i = 0; i < Math.min(virtualChildNodes.length, liveChildNodes.length); i++) {
		if(virtualChildNodes[i].nodeName !== liveChildNodes[i].nodeName) continue;

		liveByVirtual.set(virtualChildNodes[i], liveChildNodes[i]);
	}
}

function resolveLiveNode(
	virtualNode: Node,
	liveByVirtual: Map<Node, Node>,
	inheritedLiveByVirtual: Map<Node, Node>
): Node {
	const resolve = (node: Node): Node | undefined => {
		return liveByVirtual.get(node) ?? inheritedLiveByVirtual.get(node);
	};

	if(virtualNode.nodeType !== NodeType.ATTRIBUTE_NODE) return resolve(virtualNode) ?? virtualNode;

	const virtualAttr = virtualNode as Attr;
	const liveElement: Element | undefined = virtualAttr.ownerElement
		? resolve(virtualAttr.ownerElement) as Element | undefined
		: undefined;

	return liveElement?.getAttributeNodeNS(virtualAttr.namespaceURI, virtualAttr.localName)
		?? virtualAttr;
}

function applyNormalizers(
	normalizers: readonly NodeNormalizerFn[],
	virtualNode: Node,
	liveNode: Node,
	inheritedLiveByVirtual: Map<Node, Node>,
	context: NormalizerContext
): void {
	for(const normalizer of normalizers) {
		const parentNode: Node | null = virtualNode.parentNode;
		const previousSibling: Node | null = virtualNode.previousSibling;
		const nextSibling: Node | null = virtualNode.nextSibling;
		const ownerElement: Element | null = (virtualNode as Attr).ownerElement ?? null;

		normalizer(virtualNode, liveNode, context);

		// Attachment check in constant time (no ancestor walk).
		const isAttached: boolean = (virtualNode.nodeType === NodeType.ATTRIBUTE_NODE)
			? ((virtualNode as Attr).ownerElement === ownerElement)
			: (virtualNode.parentNode === parentNode);

		if(isAttached) continue;

		// Removed or replaced: replacement nodes inherit the live reference.
		for(const replacingNode of resolveReplacingNodes(parentNode, previousSibling, nextSibling)) {
			(replacingNode.nodeType === liveNode.nodeType)
				&& inheritedLiveByVirtual.set(replacingNode, liveNode);
		}

		return;
	}
}


export function preProcessDOM(
	virtualDomRoot: Element,
	liveDomRoot: Element,
	document: Document,
	options: DOMPreProcessingOptions
): void {
	const normalizers: readonly NodeNormalizerFn[] = options.normalizers;
	const context: NormalizerContext = {
		classifiers: options.classifiers,
		document
	};

	// Lazy pairing during the traversal: a node's children are paired (and composed,
	// in case of enabled shadow DOM) when the node is visited, before its normalizers run.
	const liveByVirtual: Map<Node, Node> = new Map<Node, Node>();
	// Replacements created by normalizers (never composed, only inherit).
	const inheritedLiveByVirtual: Map<Node, Node> = new Map<Node, Node>();

	// Non-full document input snippets are wrapped by BODY: pair the wrapped child.
	const virtualDomRootEquivalent: Element = (virtualDomRoot.tagName === liveDomRoot.tagName)
		? virtualDomRoot
		: (virtualDomRoot.firstElementChild ?? virtualDomRoot);

	liveByVirtual.set(virtualDomRootEquivalent, liveDomRoot);

	// Root node is not visited.
	(virtualDomRootEquivalent === virtualDomRoot)
		&& composeAndMapChildNodes(virtualDomRoot, liveDomRoot, liveByVirtual, document, options.shadowDOM);

	traverseDom<Node>(
		virtualDomRoot,
		NodeFilter.SHOW_ALL,
		(node: Node) => {
			const pairedLiveNode: Node | undefined = liveByVirtual.get(node);

			// Compose
			(pairedLiveNode && (node.nodeType === NodeType.ELEMENT_NODE))
				&& composeAndMapChildNodes(node, pairedLiveNode, liveByVirtual, document, options.shadowDOM);

			// Normalize
			// STRICT ORDER MATTERS
			// Root node is not visited, otherwise the DOM would break.
			// Attributes are visited (as nodes) before their element.
			// Replacements are traversed next (full normalizer chain, inherited live reference).

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

export function postProcessDOM(
	domRoot: Element,
	options: DOMPostProcessingOptions,
	isActionableElement: (elementNode: Element) => boolean
): void {
	// Remove elements that became empty
	if (options.filterEmptyElements) {
		// Reverse tree order: descendants precede their ancestors, so a single pass also removes
		// elements that become empty upon removal of their descendants (subtree query: no
		// document access).
		const elementNodes: Element[] = [ ...domRoot.getElementsByTagName("*") ];

		for (let i = elementNodes.length - 1; i >= 0; i--) {
			const elementNode: Element = elementNodes[i];

			if (isActionableElement(elementNode)) continue;
			if (isVoidElement(elementNode.tagName)) continue;
			if (elementNode.children.length || (elementNode.textContent ?? "").trim().length) continue;

			elementNode.remove();
		}
	}

	// Minify
	if(options.minify) {
		minifyDOM(domRoot);
	}
}

export function postProcessHTML(html: string, options: Partial<HTMLPostProcessingOptions>): string {
	const optionsWithDefaults: HTMLPostProcessingOptions = {
		debug: false,

		...options
	};

	let processedHTML = html;

	// Format
	if (optionsWithDefaults.debug) {
		processedHTML = formatHTML(processedHTML);
	}

	return processedHTML;
}
