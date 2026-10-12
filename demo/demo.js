(() => {
	const DEFAULT_HTML_INPUT = `
<section class="container" tabindex="3" required="true" type="example">
  <div class="mx-auto" data-topic="products" required="false">
    <h1>Our Pizza</h1>
    <div>
      <div class="shadow-lg">
        <h2>Margherita</h2>
        <p>
          A simple classic: mozzarella, tomatoes and basil.
          An everyday choice!
        </p>
        <button type="button">Add</button>
      </div>
      <div class="shadow-lg">
        <h2>Capricciosa</h2>
        <p>
          A rich taste: mozzarella, ham, mushrooms, artichokes and olives.
          A true favourite!
        </p>
        <button type="button">Add</button>
      </div>
    </div>
  </div>
</section>
		`.trim();
	const MAX_INDEX_LIST_TEXT_LENGTH = 100;
	const MIN_PANEL_WIDTH_FRACTION = 0.2;
	const LARGE_INPUT_SIZE_THRESHOLD = 100 * 2**10;	// 100 kB
	// Frames never load styles (nor scripts, fonts, or nested frames) – only images – for a fair before/after comparison
	const FRAME_CONTENT_SECURITY_POLICY = "default-src 'none'; img-src * data: blob:";


	const textareaHTMLInput = document.querySelector("textarea[name='html-input']");
	const textareaHTMLOutput = document.querySelector("textarea[name='html-output']");
	const textareaA11yTreeOutput = document.querySelector("textarea[name='a11y-tree-output']");
	const textareaIndexOutput = document.querySelector("textarea[name='index-output']");
	const textareaIndexJSONOutput = document.querySelector("textarea[name='index-json-output']");
	const outputTabs = textareaHTMLOutput.closest(".tabs");
	const inputFrame = document.querySelector("[data-frame='input']");
	const outputFrame = document.querySelector("[data-frame='output']");
	const canvas = document.querySelector("canvas#dom-relief");
	const panelContainer = document.querySelector("main");
	const panels = [ ...document.querySelectorAll(".panel") ];
	const resizers = [ ...document.querySelectorAll(".resizer") ];
	const tabs = [ ...document.querySelectorAll(".tabs") ];
	const metaElements = Object.fromEntries(
		[ ...document.querySelectorAll("#dom-results [data-key]") ]
			.map(element => [ element.dataset.key, element ])
	);
	const parameterOutputs = Object.fromEntries(
		[ ...document.querySelectorAll("form[name='downsampling-params'] output") ]
			.map(output => [ output.htmlFor, output ])
	);

	const snapshotButtons = [ ...document.querySelectorAll("button[data-snapshot]") ];

	const reliefInputs = {
		flat: document.querySelector("input[name='relief-flat']"),
		ortho: document.querySelector("input[name='relief-ortho']")
	};

	const domRelief = new DOMRelief.DOMRelief();

	const downsamplingInputs = {
		rE: document.querySelector("input[name='downsampling-rE']"),
		rA: document.querySelector("input[name='downsampling-rA']"),
		rT: document.querySelector("input[name='downsampling-rT']"),
		normalizers: document.querySelector("input[name='downsampling-normalizers']"),
		uniqueIDs: document.querySelector("input[name='downsampling-unique-ids']"),
		markdown: document.querySelector("input[name='downsampling-markdown']"),
		textRanker: document.querySelector("input[name='downsampling-text-ranker']"),
		filterEmptyElements: document.querySelector("input[name='downsampling-empty-elements']")
	};

	// Text formatting elements count as actionables (preserved as HTML)
	const isActionableOrTextElement = element => {
		return D2Snap.defaults.classifiers.isActionableElement(element)
			|| D2Snap.defaults.classifiers.isTextElement(element);
	};


	function formatNumber(num) {
		return num.toLocaleString("en-US", {
			maximumFractionDigits: 2
		});
	}

	function formatBytes(bytes) {
		return (bytes >= 2**10)
			? `${formatNumber(bytes / 2**10)} kB`
			: `${formatNumber(bytes)} B`;
	}

	function getDirectText(element) {
		return [ ...element.childNodes ]
			.filter(node => node.nodeType == Node.TEXT_NODE)
			.map(node => node.textContent.trim())
			.filter(Boolean)
			.join(" ");
	}

	function getTruncatedDirectText(element) {
		const directText = getDirectText(element);

		return (directText.length > MAX_INDEX_LIST_TEXT_LENGTH)
			? `${directText.slice(0, MAX_INDEX_LIST_TEXT_LENGTH)}…`
			: directText;
	}

	function getAccessibilityTreeRepresentation(dom) {
		const tree = new AccessibilityTree(dom)
			.build()
			.toString({
				collapseEmptyProperties: true,
				sourceStringCb: element => element.getAttribute?.("data-uid") || undefined
			});

		const renameSourceToUID = ({
			source,
			children,
			...node
		}) => {
			return {
				...node,
				...((source !== undefined) ? { uid: source } : {}),
				...(children ? { children: children.map(renameSourceToUID) } : {})
			};
		};

		return jsyaml.dump(renameSourceToUID(JSON.parse(tree)), {
			lineWidth: -1
		});
	}

	function getIndexListRepresentation(dom) {
		return [ ...dom.querySelectorAll("*") ]
			.map((element, i) => {
				const uid = element.getAttribute("data-uid");
				const text = getTruncatedDirectText(element);

				return `[${uid ?? i}] ${element.tagName.toUpperCase()}${text ? ` "${text}"` : ""}`;
			})
			.join("\n");
	}

	function getIndexJSONRepresentation(dom) {
		return JSON.stringify(
			[ ...dom.querySelectorAll("*") ]
				.map(element => {
					const uid = element.getAttribute("data-uid");
					const role = element.getAttribute("role");

					return {
						tagName: element.tagName.toUpperCase(),
						text: getTruncatedDirectText(element),
						...(uid ? { uid } : {}),
						...(role ? { role } : {})
					};
				}),
			null,
			2
		);
	}

	function updateMeta(meta) {
		for(const [key, value] of Object.entries(meta)) {
			const span = metaElements[key];

			if(!span) continue;

			span.textContent = value;
		}
	}

	let originalSize = 0;

	function updateSizeMeta() {
		const textarea = outputTabs.querySelector(".tabs-body > .active textarea");

		if(!textarea || !originalSize) return;

		const size = textarea.value.length;

		updateMeta({
			tokenEstimate: formatNumber(Math.round(size / 4)),
			sizeRatio: Math.round(size / originalSize * 100),
			originalSize: formatBytes(originalSize),
			snapshotSize: formatBytes(size)
		});
	}

	function renderResult3D(htmlInput, result, duration) {
		domRelief.update({
			documents: [ htmlInput, result.html ]
		});

		const [ originalDOMMeta, snapshotDOMMeta ] = domRelief.meta.documents;

		domRelief.update({
			layerThickness: Math.max(1, snapshotDOMMeta.nodes / 2500)
		});

		originalSize = result.meta.originalSize;

		updateMeta({
			originalNodes: formatNumber(originalDOMMeta.nodes),
			snapshotNodes: formatNumber(snapshotDOMMeta.nodes),
			duration: formatNumber(Math.round(duration))
		});

		updateSizeMeta();
	}

	function createFrameDocument(html) {
		return `<meta http-equiv="Content-Security-Policy" content="${FRAME_CONTENT_SECURITY_POLICY}">${html}`;
	}

	function renderResultFrames(htmlInput, result) {
		if(htmlInput) {
			inputFrame.srcdoc = createFrameDocument(htmlInput);
		}
		if(result) {
			outputFrame.srcdoc = createFrameDocument(result.outerHTML);
		}
	}

	let updateCount = 0;

	async function updateState() {
		const id = ++updateCount;
		const htmlInput = textareaHTMLInput.value;

		const rE = parseFloat(downsamplingInputs.rE.value);
		const rA = parseFloat(downsamplingInputs.rA.value);
		const rT = parseFloat(downsamplingInputs.rT.value);
		const options = {
			debug: true,
			minify: false,	// Input is normalized (minified, formatted) upon paste
			normalizers: downsamplingInputs.normalizers.checked
				? D2Snap.defaults.NORMALIZERS
				: [],
			uniqueIDs: downsamplingInputs.uniqueIDs.checked,
			sentenceRanker: downsamplingInputs.textRanker.checked
				? D2Snap.defaults.SENTENCE_RANKER
				: null,	// No ranking: leading sentences are kept
			filterEmptyElements: downsamplingInputs.filterEmptyElements.checked,
			skip: {
				markdown: !downsamplingInputs.markdown.checked
			}
		};

		const start = performance.now();
		const result = await D2Snap.d2Snap(
			htmlInput,
			rE, rA, rT,
			options
		);
		const duration = performance.now() - start;
		const resultPreservedTextFormattingElements = await D2Snap.d2Snap(
			htmlInput,
			rE, rA, rT,
			{
				...options,

				classifiers: {
					actionableElements: isActionableOrTextElement
				}
			}
		);

		if(id != updateCount) return;

		textareaHTMLOutput.value = result.html;
		textareaA11yTreeOutput.value = getAccessibilityTreeRepresentation(result.dom);
		textareaIndexOutput.value = getIndexListRepresentation(result.dom);
		textareaIndexJSONOutput.value = getIndexJSONRepresentation(result.dom);

		renderResult3D(htmlInput, result, duration);
		renderResultFrames(null, resultPreservedTextFormattingElements);
	}


	function setupIframes() {
		for(const iframe of  [ inputFrame, outputFrame ]) {
			iframe
				.addEventListener("load", () => {
					const sheet = new iframe.contentWindow.CSSStyleSheet();

					sheet.replaceSync(`
						html { font-size: 9px; }
						button, input, select, textarea { font-size: inherit; }
					`);

					iframe.contentDocument.adoptedStyleSheets = [ sheet ];
				});
		}
	}

	function setupTabs() {
		tabs
			.map(tabs => ({
				buttons: [ ...tabs.querySelectorAll(".tabs-header > button") ],
				tabViews: [ ...tabs.querySelectorAll(".tabs-body > *") ]
			}))
			.forEach(({ buttons, tabViews }) => {
				const activateTab = index => {
					buttons
						.forEach((button, i) => {
							button.classList.toggle("active", i == index);
						});
					tabViews
						.forEach((tabView, i) => {
							tabView.classList.toggle("active", i == index);
						});
				};

				buttons.forEach((button, i) => {
					button
						.addEventListener("click", () => {
							activateTab(i);
						});
				});

				activateTab(0);
			});
	}

	function setupSizeMeta() {
		outputTabs.querySelectorAll(".tabs-header > button")
			.forEach(button => {
				button.addEventListener("click", updateSizeMeta);
			});
	}

	function setupCopyButtons() {
		document.querySelectorAll("button[data-copy]")
			.forEach(button => {
				const textarea = document.querySelector(`textarea[name='${button.dataset.copy}']`);
				const label = button.textContent;

				button
					.addEventListener("click", async () => {
						await navigator.clipboard.writeText(textarea.value);

						button.textContent = "Copied";

						setTimeout(() => {
							button.textContent = label;
						}, 1500);
					});
			});
	}

	function setupClearButtons() {
		document.querySelectorAll("button[data-clear]")
			.forEach(button => {
				const textarea = document.querySelector(`textarea[name='${button.dataset.clear}']`);

				button
					.addEventListener("click", () => {
						textarea.value = "";
						textarea.focus();
						textarea.dispatchEvent(new Event("input"));
					});
			});
	}

	// Notation of snapshots (minified, formatted) without any reduction, so input and output compare.
	async function normalizeInput() {
		const { html } = await D2Snap.d2Snap(
			textareaHTMLInput.value,
			0, 0, 0,
			{
				debug: true,
				filterEmptyElements: false,
				normalizers: [],
				sentenceRanker: null,
				skip: {
					markdown: true
				}
			}
		);

		textareaHTMLInput.value = html;
	}

	function setupDownsamplingParams() {
		const isDeferredUpdate = input => {
			return (input.type === "range" && textareaHTMLInput.value.length > LARGE_INPUT_SIZE_THRESHOLD);
		};

		Object.values(downsamplingInputs)
			.forEach(input => {
				const output = parameterOutputs[input.name];

				const updateOutput = () => {
					if(!output) return;

					output.textContent = parseFloat(input.value).toFixed(1);
				};

				updateOutput();

				input
					.addEventListener("input", () => {
						updateOutput();

						if(isDeferredUpdate(input)) return;

						updateState();
					});
				input
					.addEventListener("change", () => {
						if(!isDeferredUpdate(input)) return;

						updateState();
					});
			});

		textareaHTMLInput.addEventListener("input", async e => {
			(e.inputType === "insertFromPaste")
				&& await normalizeInput();

			renderResultFrames(textareaHTMLInput.value, null);

			updateState();
		});
	}

	function setupSnapshots() {
		snapshotButtons
			.forEach(button => {
				const snapshot = window.SNAPSHOTS?.[button.dataset.snapshot];

				button
					.addEventListener("click", async () => {
						textareaHTMLInput.value = snapshot;

						await normalizeInput();

						renderResultFrames(textareaHTMLInput.value, null);

						updateState();
					});
			});
	}

	function setupRelief() {
		canvas
			.addEventListener("mousedown", () => {
				domRelief.update({
					autoRotate: false
				});
			}, {
				once: true
			});

		reliefInputs.flat
			?.addEventListener("change", e => {
				domRelief.update({
					orientation: e.target.checked ? "horizontal" : "vertical"
				});
			});

		reliefInputs.ortho
			?.addEventListener("change", e => {
				domRelief.update({
					projection: e.target.checked ? "orthographic" : "perspective"
				});
			});

		domRelief.attach(canvas);
		domRelief.update({
			orientation: "vertical",
			background: "#383B3B",
			gridColor: "#080F0F",
			gap: 0.2,
			textNodes: true,
			autoRotate: true
		});
	}

	function setupResizers() {
		let fractions = panels.map(() => 1 / panels.length);

		const applyLayout = () => {
			panelContainer.style.gridTemplateColumns = fractions
				.map(f => `minmax(0, ${f}fr)`)
				.join(" var(--space-s) ");
		};

		const stopResizing = (resizer, e) => {
			if(resizer.hasPointerCapture(e.pointerId)) {
				resizer.releasePointerCapture(e.pointerId);
			}

			document.body.classList.remove("resizing");
		};

		applyLayout();

		resizers
			.forEach((resizer, i) => {
				let startX, startA, startB;

				resizer
					.addEventListener("pointerdown", e => {
						resizer.setPointerCapture(e.pointerId);

						document.body.classList.add("resizing");

						startX = e.clientX;
						startA = fractions[i];
						startB = fractions[i + 1];
					});

				resizer
					.addEventListener("pointermove", e => {
						if(!resizer.hasPointerCapture(e.pointerId)) return;

						const style = getComputedStyle(panelContainer);
						const resizerTotal = resizers.reduce((sum, r) => sum + r.offsetWidth, 0);
						const available = panelContainer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - resizerTotal;

						if(available <= 0) return;

						const delta = (e.clientX - startX) / available;
						const pair = startA + startB;
						const min = Math.min(MIN_PANEL_WIDTH_FRACTION, pair / 2);
						const a = Math.min(Math.max(startA + delta, min), pair - min);

						fractions[i] = a;
						fractions[i + 1] = pair - a;

						applyLayout();
					});

				resizer
					.addEventListener("pointerup", e => {
						stopResizing(resizer, e);
					});
				resizer
					.addEventListener("pointercancel", e => {
						stopResizing(resizer, e);
					});
			});
	}


	setupIframes();
	setupTabs();
	setupSizeMeta();
	setupCopyButtons();
	setupClearButtons();
	setupDownsamplingParams();
	setupSnapshots();
	setupRelief();
	setupResizers();

	textareaHTMLInput.value ||= DEFAULT_HTML_INPUT;

	normalizeInput()
		.then(() => {
			renderResultFrames(textareaHTMLInput.value, null);

			updateState();
		})
		.finally(() => {
			document.body
				.classList
				.add("ready");
		});
})();