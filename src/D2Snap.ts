import { Turndown } from "./Turndown.js";
import {
	type DeepPartial,
	type D2SnapOptions,
	type D2SnapResult,
	type DOM,
	type ElementClassifierFn,
	type NodeNormalizerFn,
	type ElementWithDepth,
	type SentenceRankerFn,
	type TextNode
} from "./types.js";
import { NodeType, NodeFilter } from "./enums.js";
import { CONFIG } from "./config.js";
import { resolveDocument, resolveRoot, traverseDom } from "./util.dom.js";
import { isVoidElement } from "./util.html.js";
import { postProcessDOM, postProcessHTML, preProcessDOM } from "./D2Snap.processing.js";
import { deepMerge } from "./util.obj.js";
import { transformWithRanking } from "./util.text.js";
import {
	DEFAULT_ATTRIBUTE_SCORES,
	DEFAULT_CLASSIFIERS,
	DEFAULT_NORMALIZERS,
	DEFAULT_SENTENCE_RANKER
} from "./constants.defaults.js";
import { uniqueIDs } from "./options.normalizers.js";


const WHITESPACE_REGEX: RegExp = /^\s$/;
// Markdown autolinks re-parse (see snapElementTextFormattingNode) into bogus
// elements tagged with the URL scheme — `<https://x>` -> `HTTPS:` (parser stops
// at `/`), `<mailto:x@y.com>` -> `MAILTO:X@Y.COM` (no `/`, whole URI folds in).
// Both act as containers and swallow siblings, so both must be unwrapped. The
// negative lookahead spares real namespaced custom elements (`FB:LIKE`), whose
// tail after `:` is a valid NCName.
const COLON_SCHEME_TAG_REGEX: RegExp = /^[a-z][a-z0-9+.-]*:(?![a-z_][a-z0-9_.-]*$)/i;

function validateUnitParameter(name: string, value: number) {
	if(!Number.isFinite(value) || value < 0 || value > 1) {
		throw new RangeError(`Parameter ${name} expects value in [0, 1], got ${value}`);
	}
}

function defineNonEnumerableProperty(obj: object, prop: string, value: unknown) {
	Object.defineProperty(obj, prop, {
		value,
		writable: false,
		configurable: true,
		enumerable: false
	});
}


export function getAttributeScore(attrName: string, attributeScores: Map<string, number> = new Map(
	Object.entries(DEFAULT_ATTRIBUTE_SCORES)
		.map((entry: [ string, number ]) => [ entry[0].toLowerCase(), entry[1] ])
)) {
	let normalizedName: string = attrName.toLowerCase();

	if(!attributeScores.has(normalizedName)) {
		const nameParts = normalizedName.split("-");

 		for(let i = nameParts.length - 1; i > 0; i--) {
			const wildcardName = `${nameParts.slice(0, i).join("-")}-*`;

			if(attributeScores.has(wildcardName)) {
				normalizedName = wildcardName;

				break;
			}
		}
	}

	const attributeScore: number = attributeScores.get(normalizedName)
		?? attributeScores.get(CONFIG.attributeScoresFallbackKey)
		?? CONFIG.attributeScoresDefaultFallbackValue;

	return attributeScore;
}

export function d2Snap(
	dom: DOM,
	rE: number, rA: number, rT: number,
	options: DeepPartial<D2SnapOptions> = {}
): D2SnapResult {
	validateUnitParameter("rE", rE);
	validateUnitParameter("rA", rA);
	validateUnitParameter("rT", rT);

	const document = resolveDocument(dom);
	if(!document) throw new ReferenceError("Could not resolve a valid document object from DOM");

	const rootElement: Element = resolveRoot(dom)
	const originalSize = rootElement.innerHTML.length;
	const optionsWithDefaults: D2SnapOptions = deepMerge<D2SnapOptions, DeepPartial<D2SnapOptions>>({
		attributeScores: DEFAULT_ATTRIBUTE_SCORES,
		classifiers: DEFAULT_CLASSIFIERS,
		debug: false,
		filterEmptyElements: true,
		minify: true,
		normalizers: DEFAULT_NORMALIZERS,
		shadowDOM: false,
		sentenceRanker: DEFAULT_SENTENCE_RANKER,
		skip: {
			markdown: false,
			textRank: false
		},
		uniqueIDs: false
	}, options);
	const attributeScores: Map<string, number> = new Map(
		Object.entries(optionsWithDefaults.attributeScores)
			.map((entry: [ string, number ]) => [ entry[0].toLowerCase(), entry[1] ])
	);

	const _isActionableElement: ElementClassifierFn<Element> = optionsWithDefaults.classifiers.actionableElements;
	const _isTextElement: ElementClassifierFn<Element> = optionsWithDefaults.classifiers.textElements;
	// Skipped ranking keeps the leading sentences (a given sentence ranker wins).
	const _sentenceRanker: SentenceRankerFn = (optionsWithDefaults.skip?.textRank && !options.sentenceRanker)
		? (sentences: string[]) => sentences
		: optionsWithDefaults.sentenceRanker;

	const turndown: Turndown = new Turndown([ _isActionableElement ]);

	function snapElementContainerNode(elementNode: ElementWithDepth, rE: number) {
		const considerContainerElement = (elementNode: Element) => {
			if(elementNode.nodeType !== NodeType.ELEMENT_NODE) return false;
			if(_isActionableElement(elementNode)) return false;
			if(isVoidElement(elementNode.tagName)) return false;

			return true;
		};

		if(!considerContainerElement(elementNode)) return;
		if(!elementNode.parentElement || !considerContainerElement(elementNode.parentElement)) return;

		// Merge (Bresenham gate)
		const ratio = Math.min(1, Math.max(0, rE));
		const isMergeLevel = (elementNode.depth > 1) && (Math.floor(elementNode.depth * ratio) > Math.floor((elementNode.depth - 1) * ratio));
		if(!isMergeLevel) return;

		const targetElement = elementNode.parentElement as ElementWithDepth;
		const sourceElement: ElementWithDepth = elementNode;

		while(sourceElement.childNodes.length) {
			targetElement
				.insertBefore(sourceElement.childNodes[0], sourceElement);
		}

		sourceElement
			.parentNode
			?.removeChild(sourceElement);
	}

	function snapElementTextFormattingNode(document: Document, elementNode: HTMLElement) {
		if(optionsWithDefaults.skip?.markdown) return;
		if(elementNode.nodeType !== NodeType.ELEMENT_NODE) return;
		if(_isActionableElement(elementNode)) return;
		if(!_isTextElement(elementNode)) return;

		// Markdown
		const markdown = turndown.translate(elementNode.outerHTML);
		const markdownNodesFragment = document
			.createRange()
			.createContextualFragment(markdown);

		// Drop bogus `<scheme:>` elements the HTML parser synthesises from
		// markdown autolinks before they enter the tree (and become containers).
		const unwrapColonTaggedElements = (parent: Node) => {
			for(const child of [ ...parent.childNodes ]) {
				if(child.nodeType !== NodeType.ELEMENT_NODE) continue;

				// Recurse first so nested artifacts (and kept content) are resolved
				// before this element is potentially unwrapped.
				unwrapColonTaggedElements(child);

				if(!COLON_SCHEME_TAG_REGEX.test((child as Element).tagName)) continue;

				while(child.firstChild) {
					parent.insertBefore(child.firstChild, child);
				}

				parent.removeChild(child);
			}
		};
		unwrapColonTaggedElements(markdownNodesFragment);

		const replacingNodes: Node[] = [...markdownNodesFragment.childNodes];

		elementNode
			.replaceWith(...[ document.createTextNode(" "), ...replacingNodes, document.createTextNode(" ") ]);

		// Strip same-tag replacements before returning for re-traversal:
		// Turndown passes some textFormatting elements through verbatim
		// (e.g. <table> without <thead>), and re-visiting them would feed
		// the same input back to Turndown forever.
		const sourceTagName: string = elementNode.tagName.toLowerCase();

		return replacingNodes
			.filter(n => (
				(n.nodeType !== NodeType.ELEMENT_NODE)
				|| ((n as Element).tagName.toLowerCase() !== sourceTagName)
			));
	}

	function snapTextNode(textNode: TextNode, rT: number) {
		if(textNode.nodeType !== NodeType.TEXT_NODE) return;

		const text: string | null = textNode.textContent;
		if(!(text ?? "").trim().length) return;

		const leadingSpace: string = WHITESPACE_REGEX.test(text.charAt(0)) ? " " : "";
		const trailingSpace: string = WHITESPACE_REGEX.test(text.charAt(text.length - 1)) ? " " : "";

		textNode.textContent = [
			leadingSpace,
			transformWithRanking(text, (1 - rT), _sentenceRanker, true),
			trailingSpace
		].join("");
	}

	function snapAttributeNode(elementNode: HTMLElement, rA: number) {
		if(elementNode.nodeType !== NodeType.ELEMENT_NODE) return;

		for(const attr of Array.from(elementNode.attributes)) {
			if(getAttributeScore(attr.name, attributeScores) >= rA) continue;

			elementNode.removeAttribute(attr.name);
		}
	}

	const t = optionsWithDefaults.debug
		? performance.now.bind(performance)
		: () => 0;

	let t0: number;
	const timings: D2SnapResult["meta"]["timings"] = {};

	// Clone
	t0 = t();
	const inertDoc: Document = document.implementation.createHTMLDocument("");
	// Shadow DOM content is composed into the clone during pre-processing (if enabled).
	const rootElementClone: DOM = inertDoc.importNode(rootElement, true);
	switch(rootElement.localName.toLowerCase()) {
		case "html":
			inertDoc.replaceChild(rootElementClone, inertDoc.documentElement);
			break;
		case "body":
			inertDoc.documentElement.replaceChild(rootElementClone, inertDoc.body);
			break;
		default:
			inertDoc.body.appendChild(rootElementClone);
	}
	// Wrap local DOM input (e.g., SECTIOn snippet) in BODY to allow destructive mutation
	// of input DOM root.  
	const virtualDOM = (rootElement.nodeType === NodeType.DOCUMENT_NODE)
		? inertDoc.documentElement
		: inertDoc.body;
	// Live equivalent of the virtual DOM root (or of its BODY-wrapped child).
	const liveDOM: Element = (rootElement.localName.toLowerCase() === "html")
		? (rootElement.querySelector("body") ?? rootElement)
		: rootElement;
	timings.clone = t() - t0;

	// Unique IDs shortcut: last normalizer, unless explicitly placed.
	const normalizers: NodeNormalizerFn[] = [ ...optionsWithDefaults.normalizers ];
	optionsWithDefaults.uniqueIDs
		&& !normalizers.includes(uniqueIDs)
		&& normalizers.push(uniqueIDs);

	// Pre-proces
	t0 = t();
	preProcessDOM(virtualDOM, liveDOM, inertDoc, {
		classifiers: optionsWithDefaults.classifiers,
		normalizers,
		shadowDOM: optionsWithDefaults.shadowDOM
	});
	timings.preProcessing = t() - t0;

	// Write depth and role per node
	// TODO: Write hidden or remove in post-processing step
	t0 = t();
	traverseDom<ElementWithDepth>(
		virtualDOM,
		NodeFilter.SHOW_ELEMENT,
		(element: ElementWithDepth) => {
			const depth: number = ((element?.parentNode as ElementWithDepth)?.depth ?? 0) + 1;
			defineNonEnumerableProperty(element, "depth", depth);

			const role: string | null = element.getAttribute("role");
			role
				&& defineNonEnumerableProperty(element, "role", role);
		}
	);
	timings.writeDepth = t() - t0;

	// Text nodes
	t0 = t();
	traverseDom<TextNode>(
		virtualDOM,
		NodeFilter.SHOW_TEXT,
		(node: TextNode) => snapTextNode(node, rT)
	);
	timings.textNodes = t() - t0;

	// Text formatting element nodes
	t0 = t();
	traverseDom<HTMLElement>(
		virtualDOM,
		NodeFilter.SHOW_ELEMENT,
		(node: HTMLElement) => snapElementTextFormattingNode(inertDoc, node)
	);
	timings.textFormatting = t() - t0;

	// Container element nodes
	t0 = t();
	traverseDom<ElementWithDepth>(
		virtualDOM,
		NodeFilter.SHOW_ELEMENT,
		(node: ElementWithDepth) => snapElementContainerNode(node, rE)
	);
	timings.containers = t() - t0;

	// Attribute nodes
	t0 = t();
	traverseDom<HTMLElement>(
		virtualDOM,
		NodeFilter.SHOW_ELEMENT,
		(node: HTMLElement) => snapAttributeNode(node, rA)
	);
	timings.attributes = t() - t0;

	// Actionable element nodes
	// ! Designated no-op !

	// Dissolve toplevel tags for rE = 1 (allows full linearization)
	if(rE === 1.0) {
		[ ...virtualDOM.querySelectorAll("*") ]
			.filter((elementNode: Element) => !_isActionableElement(elementNode))
			.forEach((element: Element) => {
				element.replaceWith(...element.childNodes);
			});
	}

	// Post-process (DOM)
	t0 = t();
	postProcessDOM(virtualDOM, {
		filterEmptyElements: optionsWithDefaults.filterEmptyElements,
		minify: optionsWithDefaults.minify
	}, _isActionableElement);
	timings.domPostProcessing = t() - t0;

	const serialisation: {
		innerHTML?: string;
		outerHTML?: string;
	} = {};
	const getHTML = (property: "innerHTML" | "outerHTML"): string => {
		if(serialisation[property] !== undefined) {
			return serialisation[property];
		}

		// Serialize
		t0 = t();
		let html = virtualDOM[property];
		timings.serialize = t() - t0;

		// Post-process (HTML)
		t0 = t();
		html = postProcessHTML(html, {
			debug: optionsWithDefaults.debug
		});
		timings.htmlPostProcessing = t() - t0;

		serialisation[property] = html;

		return html;
	};

	return {
		dom: virtualDOM,
		get html() {
			return getHTML("innerHTML");
		},
		get innerHTML() {
			return getHTML("innerHTML");
		},
		get outerHTML() {
			return getHTML("outerHTML");
		},
		meta: {
			originalSize,
			get snapshotSize() {
				return getHTML("innerHTML").length;
			},
			get sizeRatio() {
				return getHTML("innerHTML").length / originalSize
			},
			get tokenEstimate() {
				return Math.round(getHTML("innerHTML").length / 4)
			},	// according to https://platform.openai.com/tokenizer

			...(optionsWithDefaults.debug && { timings })
		}
	};
}