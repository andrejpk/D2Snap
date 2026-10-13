import type { Preview, ViewerData, ViewerGoal, ViewerResult, ViewerState, ViewerSuite } from "./viewer-model.ts";
import { createSourceViewer, type SourceViewer } from "./source-viewer.ts";
import { sizeBar } from "./size-bar.ts";
import { cellId } from "./cell-id.ts";
import { aggregateResults, aggregateCells } from "./aggregation.ts";
import type { AggregateRow } from "./aggregation.ts";

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text: string, action: () => void, className = "bench-button"): HTMLButtonElement {
  const element = node("button", text, className);
  element.type = "button";
  element.addEventListener("click", action);
  return element;
}

function download(name: string, content: string, type = "text/plain;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = node("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function label(id: string): string {
  return id.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function ratio(result: ViewerResult, category: "content" | "control" | "overall"): string {
  const value = result.assessment.retention[category];
  return value.denominator ? `${value.numerator} / ${value.denominator}` : "N/A";
}

function profileDescription(result: ViewerResult): string {
  if (!result.configuration) return "Uncompressed captured DOM. No D2Snap transformation; the same evidence rules still assess it.";
  const { rE, rA, rT } = result.configuration;
  if (rE === rA && rA === rT) return `Uniform reduction ${rE.toFixed(1)}: rE, rA and rT are all ${rE.toFixed(1)}. Higher levels request more reduction, not higher fidelity.`;
  return "A saved custom profile. See its exact parameters and options below.";
}

interface Pane {
  side: "raw" | "output";
  element: HTMLElement;
  frame: HTMLIFrameElement;
  source: HTMLElement;
  sourceViewer: SourceViewer;
  locationState: HTMLElement;
  image?: HTMLImageElement;
  preview: Preview;
  mode: string;
  loaded: boolean;
}

function start(data: ViewerData, root: HTMLElement, standaloneHTML: string, suite?: ViewerSuite,
  back?: () => void, focusProfile?: string): void {
  if (data.schemaVersion !== 1 || !data.states.length || !data.results.length) {
    throw new Error("This report has no supported experiment results.");
  }
  root.replaceChildren();
  const profiles = [...new Map(data.results.map(result => [result.profileId, result])).values()];
  let activeConfig = profiles.find(result => result.configuration)?.profileId ?? "raw";

  const heading = node("header", "", "bench-heading");
  const headingText = node("div");
  headingText.append(node("p", "D2SNAP / PERCEPTION BENCH", "eyebrow"),
    node("p", `${label(data.report.stackId)}  /  ${label(data.report.caseId)}  /  ${label(data.report.variantId)}`, "muted"));
  const actions = node("div", "", "bench-actions");
  if (back) actions.append(button("Back to dashboard", back));
  actions.append(button("Download standalone HTML", () => download("perception-bench.html", standaloneHTML, "text/html;charset=utf-8")),
    button("Theme", () => {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      document.querySelectorAll("iframe").forEach(frame => {
        if (frame.contentDocument) frame.contentDocument.documentElement.dataset.theme = theme;
      });
    }));
  if (["http:", "https:"].includes(location.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)
    && (suite || ["/", "/index.html"].includes(location.pathname))) {
    const live = node("a", "Open interactive fixture", "bench-button bench-primary");
    live.href = suite
      ? `/cells/${cellId(data.report)}/index.html`
      : `/fixture/?clawpilotTheme=${document.documentElement.dataset.theme ?? "light"}`;
    if (suite) live.textContent = "Open cell report";
    live.target = "_blank";
    live.rel = "noopener";
    actions.append(live);
  }
  heading.append(headingText, actions);
  if (suite) {
    const selector = node("select");
    selector.setAttribute("aria-label", "Framework stack");
    for (const cell of suite.cells) {
      const option = node("option", `${label(cell.report.stackId)} / ${label(cell.report.variantId)}`);
      option.value = cellId(cell.report);
      option.selected = option.value === cellId(data.report);
      selector.append(option);
    }
    selector.addEventListener("change", () => {
      const next = suite.cells.find(cell => cellId(cell.report) === selector.value);
      if (!next) throw new Error("Selected matrix cell is missing.");
      start(next, root, standaloneHTML, suite, back, focusProfile);
      root.querySelector<HTMLSelectElement>('select[aria-label="Framework stack"]')?.focus();
    });
    headingText.append(selector);
  }
  const navigation = node("nav", "", "bench-navigation");
  navigation.setAttribute("aria-label", "Report sections");
  const overview = node("div");
  overview.id = "results-panel";
  const configurations = node("section", "", "bench-configurations");
  configurations.id = "configurations-panel";
  configurations.hidden = true;
  const resultsTab = button("Results", () => showSection(false));
  const configsTab = button("Configurations", () => showSection(true));
  resultsTab.setAttribute("aria-controls", overview.id);
  configsTab.setAttribute("aria-controls", configurations.id);
  navigation.append(resultsTab, configsTab);
  function showSection(config: boolean): void {
    overview.hidden = config;
    configurations.hidden = !config;
    resultsTab.setAttribute("aria-pressed", String(!config));
    configsTab.setAttribute("aria-pressed", String(config));
  }
  showSection(false);
  root.append(heading, navigation, overview, configurations);

  for (const state of data.states) {
    const section = node("section", "", "bench-state");
    const top = node("div", "", "bench-section-heading");
    const title = node("div");
    title.append(node("h2", label(state.id)), node("p", state.description, "muted"));
    const screenshot = button("Captured screenshot", () => openScreenshot(state));
    top.append(title, screenshot);
    section.append(top);
    const rows = data.results.filter(result => result.stateId === state.id);
    const maximumBytes = Math.max(0, ...rows.map(result => result.assessment.outputBytes));
    if (!rows.find(result => result.profileId === "raw")?.assessment.fullFidelity) {
      section.append(node("p", "Raw evidence is incomplete. Investigate fixture, acquisition or reader limitations before attributing losses to D2Snap.", "notice"));
    }
    const scroller = node("div", "", "scroll");
    const table = node("table", "", "bench-results-table");
    table.setAttribute("aria-label", `${label(state.id)} performance`);
    const head = node("thead");
    const header = node("tr");
    ["Configuration", "Content", "Controls", "All goals", "Semantic", "Output KB", "Size vs raw", "Compare"].forEach(text => header.append(node("th", text)));
    head.append(header);
    const body = node("tbody");
    for (const result of rows) {
      const row = node("tr");
      row.dataset.resultId = result.id;
      if (result.profileId === focusProfile) row.classList.add("bench-focused-result");
      const config = node("td");
      config.append(button(label(result.profileId), () => {
        activeConfig = result.profileId;
        renderConfiguration();
        if (focusProfile) {
          const selected = [...root.querySelectorAll<HTMLElement>("[data-result-id]")]
            .find(row => row.dataset.resultId === `${data.states[0]!.id}-${focusProfile}`);
          const inspect = selected?.querySelector<HTMLButtonElement>(".bench-inspect-button");
          inspect?.focus();
          selected?.scrollIntoView({ block: "center" });
        }
        showSection(true);
        configurations.querySelector<HTMLElement>("h2")?.focus();
      }, "bench-text-button"));
      const size = sizeBar(result.assessment.outputBytes, maximumBytes);
      const sizeCell = node("td", "", "bench-size-cell bench-numeric");
      sizeCell.title = size.description;
      sizeCell.setAttribute("aria-label", size.description);
      const track = node("span", "", "bench-size-track");
      track.setAttribute("aria-hidden", "true");
      const bar = node("span", "", "bench-size-bar");
      bar.style.width = `${size.percentage}%`;
      track.append(bar);
      sizeCell.append(track, node("span", size.kb, "bench-size-value"));
      row.append(config, node("td", ratio(result, "content")), node("td", ratio(result, "control")),
        node("td", ratio(result, "overall"), result.assessment.fullFidelity ? "pass" : "fail"),
        node("td", `${result.assessment.semanticRetention.overall.numerator} / ${result.assessment.semanticRetention.overall.denominator}`),
        sizeCell,
        node("td", result.assessment.sizeRatio === null ? "N/A" : `${(result.assessment.sizeRatio * 100).toFixed(1)}%`));
      const cell = node("td");
      const inspect = button("Inspect", () => openInspector(result, inspect), "bench-button bench-inspect-button");
      inspect.setAttribute("aria-label", `Inspect ${label(state.id)} / ${label(result.profileId)}`);
      cell.append(inspect);
      row.append(cell);
      body.append(row);
    }
    table.append(head, body);
    scroller.append(table);
    section.append(scroller);
    overview.append(section);
  }

  const provenance = node("details", "", "bench-provenance");
  provenance.append(node("summary", "Technical provenance and cache diagnostics"),
    node("p", "These describe how the report was produced, not D2Snap quality. No runtime LLM is used."),
    node("pre", JSON.stringify({
      generatedAt: data.report.generatedAt, subject: data.report.subject,
      fixtureHash: data.report.fixtureHash, browser: data.report.browser,
      counts: data.report.counts,
      results: data.report.results.map(result => ({
        state: result.stateId, profile: result.profileId,
        captureKey: result.captureKey, transformKey: result.transformKey, assessmentKey: result.assessmentKey, cache: result.cache,
      })),
    }, null, 2)),
    button(suite ? "Download matrix results JSON" : "Download results JSON", () => download("results.json", JSON.stringify(suite
      ? { schemaVersion: 1, kind: "matrix", generatedAt: suite.generatedAt, reports: suite.cells.map(cell => cell.report) }
      : data.report, null, 2), "application/json")));
  root.append(provenance, node("p", "A frozen, self-contained experiment artifact. Configuration exploration and highlighting do not rerun D2Snap or change any score.", "muted bench-footer"));

  function renderConfiguration(): void {
    configurations.replaceChildren();
    const title = node("h2", "Explore configurations");
    title.tabIndex = -1;
    configurations.append(title, node("p", "These are saved diagnostic probes, not recommendations or live controls. Changing the selection only explores recorded settings.", "muted"));
    const layout = node("div", "", "bench-config-layout");
    const list = node("div", "", "bench-profile-list");
    list.setAttribute("aria-label", "Saved configurations");
    for (const profile of profiles) {
      const select = button(label(profile.profileId), () => {
        activeConfig = profile.profileId;
        renderConfiguration();
        configurations.querySelector<HTMLButtonElement>(`[data-profile-id="${profile.profileId}"]`)?.focus();
      });
      select.dataset.profileId = profile.profileId;
      select.setAttribute("aria-pressed", String(profile.profileId === activeConfig));
      list.append(select);
    }
    const selected = profiles.find(profile => profile.profileId === activeConfig);
    if (!selected) throw new Error(`Unknown configuration: ${activeConfig}`);
    const detail = node("div", "", "bench-config-detail");
    detail.append(node("h3", label(selected.profileId)),
      node("p", profileDescription(selected)));
    const configuration = selected.configuration;
    if (!configuration) {
      detail.append(node("p", "The raw baseline is captured HTML, assessed with the same goal contract. There is no reduction configuration, Markdown conversion, or D2Snap preprocessing.", "notice"));
    } else {
      const parameters = node("div", "", "bench-parameters");
      for (const [key, value, explanation] of [
        ["rE", configuration.rE, "Container reduction. Higher values unwrap more eligible structure; not every element is removable."],
        ["rA", configuration.rA, "Attribute threshold. Attributes with scores below this value are removed; equal scores survive this pass."],
        ["rT", configuration.rT, "Text reduction. D2Snap passes 1 - rT as the text retention parameter; actual retained content depends on the text pass."],
      ] as const) {
        const card = node("div", "", "bench-parameter");
        card.append(node("small", key), node("strong", String(value)), node("p", explanation));
        parameters.append(card);
      }
      const options = node("table", "", "bench-options-table");
      options.setAttribute("aria-label", "Preprocessing options");
      const tbody = node("tbody");
      const names: Record<string, string> = {
        debug: "Debug formatting", skipMarkdown: "Skip Markdown conversion", skipTextRank: "Skip TextRank",
        liftImageDescription: "Lift image descriptions", uniqueIDs: "Inject synthetic IDs",
        filterDataURLs: "Filter data URLs", filterEmptyElements: "Filter empty elements",
      };
      for (const [key, text] of Object.entries(names)) {
        const row = node("tr");
        row.append(node("th", text), node("td", String(configuration.options[key as keyof typeof configuration.options])));
        tbody.append(row);
      }
      options.append(tbody);
      detail.append(parameters, node("h3", "Preprocessing and options"), options,
        node("p", "A zero reduction profile still runs enabled preprocessing. These complete options are recorded in the experiment identity; exploration here is read-only.", "muted"));
      const attributes = node("details", "", "bench-attributes");
      attributes.open = true;
      attributes.append(node("summary", "Attribute scoring"));
      const filter = node("input");
      filter.type = "search";
      filter.placeholder = "Filter attribute names...";
      filter.setAttribute("aria-label", "Filter attribute scores");
      const attrTable = node("table");
      attrTable.setAttribute("aria-label", "Attribute scores");
      const attrHead = node("thead");
      const attrHeaders = node("tr");
      ["Attribute", "Score", `At rA = ${configuration.rA}`].forEach(text => attrHeaders.append(node("th", text)));
      attrHead.append(attrHeaders);
      const attrBody = node("tbody");
      function showAttributes(): void {
        attrBody.replaceChildren();
        for (const [name, score] of Object.entries(configuration!.options.attributeScoring).sort(([a], [b]) => a.localeCompare(b))) {
          if (!name.toLowerCase().includes(filter.value.toLowerCase())) continue;
          const keep = score >= configuration!.rA;
          const row = node("tr");
          row.append(node("td", name), node("td", String(score)), node("td", keep ? "Kept by attribute pass" : "Removed by attribute pass", keep ? "pass" : "fail"));
          attrBody.append(row);
        }
      }
      filter.addEventListener("input", showAttributes);
      showAttributes();
      attrTable.append(attrHead, attrBody);
      const scroll = node("div", "", "bench-attribute-scroll");
      scroll.append(attrTable);
      attributes.append(filter, scroll, node("p", `Unknown attributes use fallback ${configuration.options.attributeScoringFallback}. Wildcard entries such as aria-* cover that family. Other passes may still remove an element or its relationships.`, "muted"));
      const json = node("details");
      json.append(node("summary", "Complete configuration JSON"), node("pre", JSON.stringify(configuration, null, 2)));
      detail.append(attributes, json, button("Download configuration", () => {
        const { options, ...profile } = configuration;
        download(`${profile.id}.json`, JSON.stringify({ schemaVersion: 1, options, profiles: [profile] }, null, 2), "application/json");
      }));
    }
    layout.append(list, detail);
    configurations.append(layout);
  }
  renderConfiguration();

  function openScreenshot(state: ViewerState): void {
    const previous = document.activeElement;
    const dialog = node("dialog", "", "bench-screenshot-dialog");
    dialog.setAttribute("aria-label", `${label(state.id)} captured screenshot`);
    const image = node("img");
    image.src = state.screenshot;
    image.alt = `Original captured ${label(state.id)} page`;
    dialog.append(button("Close screenshot", () => dialog.close()), image);
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (previous instanceof HTMLElement) previous.focus();
    }, { once: true });
    root.append(dialog);
    dialog.showModal();
  }

  function openInspector(initial: ViewerResult, trigger: HTMLButtonElement): void {
    const dialog = node("dialog", "", "bench-inspector");
    dialog.setAttribute("aria-labelledby", "inspector-title");
    let result = initial;
    let selectedGoal: ViewerGoal | undefined;
    let panes: [Pane, Pane] | undefined;
    let comparison: HTMLElement;
    let arrow: SVGSVGElement;
    let path: SVGPathElement;
    let pending = 0;
    let observer: ResizeObserver | undefined;
    let goalButtons: HTMLButtonElement[] = [];
    let goalDetails: HTMLElement;

    function scheduleArrow(): void {
      if (pending) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => { pending = 0; drawArrow(); });
    }
    function drawArrow(): void {
      arrow.setAttribute("hidden", "");
      if (!selectedGoal || !panes || !comparison.isConnected) return;
      const outer = comparison.getBoundingClientRect();
      const points = panes.map(pane => {
        const highlight = pane.preview.highlights[selectedGoal!.id];
        if (pane.mode !== "rendered" || !pane.loaded || !highlight || highlight.selectors.length !== 1) return undefined;
        const target = pane.frame.contentDocument?.querySelector(highlight.selectors[0]!);
        if (!target) return undefined;
        const box = target.getBoundingClientRect();
        const frame = pane.frame.getBoundingClientRect();
        const left = Math.max(0, box.left), top = Math.max(0, box.top);
        const right = Math.min(frame.width, box.right), bottom = Math.min(frame.height, box.bottom);
        if (right <= left || bottom <= top) return undefined;
        return { x: frame.left - outer.left + (left + right) / 2, y: frame.top - outer.top + (top + bottom) / 2 };
      });
      const [a, b] = points;
      if (!a || !b) return;
      arrow.setAttribute("viewBox", `0 0 ${outer.width} ${outer.height}`);
      const bend = Math.max(40, Math.abs(b.x - a.x) / 3);
      path.setAttribute("d", `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`);
      const match = panes.every(pane => pane.preview.highlights[selectedGoal!.id]?.kind === "match");
      arrow.dataset.kind = match ? "match" : "context";
      arrow.removeAttribute("hidden");
    }
    function paint(pane: Pane, scroll: boolean): void {
      if (!selectedGoal) return;
      const highlight = pane.preview.highlights[selectedGoal.id];
      pane.sourceViewer.highlight(pane.preview.sourceHighlights[selectedGoal.id], pane.mode === "source");
      if (!pane.loaded || !pane.frame.contentDocument) return;
      const document = pane.frame.contentDocument;
      document.querySelectorAll("[data-bench-highlight]").forEach(element => element.removeAttribute("data-bench-highlight"));
      const targets = (highlight?.selectors ?? []).flatMap(selector => [...document.querySelectorAll(selector)]);
      pane.locationState.hidden = pane.mode !== "rendered" || targets.length > 0;
      pane.locationState.textContent = selectedGoal.passed
        ? "No rendered location available for this goal."
        : "Missing: no matching or context content in this view.";
      for (const target of targets) target.setAttribute("data-bench-highlight", highlight?.kind ?? "none");
      if (scroll && pane.mode === "rendered") targets[0]?.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
      scheduleArrow();
    }
    function chooseGoal(goal: ViewerGoal): void {
      selectedGoal = goal;
      goalButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.goalId === goal.id)));
      goalDetails.replaceChildren(node("h3", goal.passed ? "Retained" : "Missing", goal.passed ? "pass" : "fail"),
        node("p", goal.description));
      if (goal.passed) {
        goalDetails.append(node("small", "Passing evidence alternatives"), node("pre", goal.matchedAlternatives.join("\n")));
        goalDetails.append(node("p", goal.semanticPassed ? "Explicit semantic evidence retained." : "Retained through deterministic inference."));
        if (goal.inferenceRules.length) goalDetails.append(node("pre", goal.inferenceRules.join("\n")));
      } else {
        const reasons = node("ul", "", "bench-reasons");
        goal.reasons.forEach(reason => reasons.append(node("li", reason)));
        goalDetails.append(reasons);
      }
      panes?.forEach(pane => paint(pane, true));
    }
    function createPane(side: "raw" | "output", state: ViewerState): Pane {
      const raw = side === "raw";
      const element = node("section", "", "bench-pane");
      element.setAttribute("aria-label", raw ? "Raw comparison pane" : "Output comparison pane");
      const top = node("div", "", "bench-pane-header");
      const info = node("div");
      info.append(node("h3", raw ? "Raw captured DOM" : "D2Snap output"),
        node("small", `${(raw ? state.rawBytes / 1000 : result.assessment.outputKB).toFixed(3)} KB  /  ${raw ? "Baseline" : label(result.profileId)}`));
      const modes = node("div", "", "bench-modes");
      modes.setAttribute("aria-label", raw ? "Raw view mode" : "Output view mode");
      const frame = node("iframe");
      frame.title = raw ? "Raw rendered preview" : "Output rendered preview";
      frame.tabIndex = -1;
      frame.setAttribute("sandbox", "allow-same-origin");
      const sourceViewer = createSourceViewer(raw ? state.raw : result.output, side);
      const source = sourceViewer.element;
      source.hidden = true;
      const viewport = node("div", "", "bench-pane-viewport");
      const locationState = node("p", "", "bench-location-state");
      locationState.setAttribute("role", "status");
      locationState.hidden = true;
      const previewError = node("p", "", "notice");
      previewError.setAttribute("role", "alert");
      previewError.hidden = true;
      const pane: Pane = {
        side, element, frame, source, sourceViewer, locationState, preview: raw ? state.preview : result.preview,
        mode: "rendered", loaded: false,
      };
      const controls: HTMLButtonElement[] = [];
      for (const mode of raw ? ["rendered", "source", "screenshot"] : ["rendered", "source"]) {
        const control = button(label(mode), () => {
          pane.mode = mode;
          controls.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
          frame.hidden = mode !== "rendered";
          source.hidden = mode !== "source";
          if (mode === "source") sourceViewer.show();
          if (pane.image) pane.image.hidden = mode !== "screenshot";
          paint(pane, true);
          scheduleArrow();
        });
        control.dataset.mode = mode;
        control.setAttribute("aria-pressed", String(mode === "rendered"));
        controls.push(control);
        modes.append(control);
      }
      modes.append(button("Download", () => download(`${cellId(data.report)}.${result.stateId}.${raw ? "input" : result.profileId + ".output"}.txt`, raw ? state.raw : result.output)));
      top.append(info, modes, previewError);
      viewport.append(frame, source, locationState);
      if (raw) {
        pane.image = node("img", "", "bench-pane-screenshot");
        pane.image.src = state.screenshot;
        pane.image.alt = "Original captured page";
        pane.image.hidden = true;
        viewport.append(pane.image);
      }
      element.append(top, viewport);
      frame.addEventListener("load", () => {
        if (!frame.isConnected) return;
        const doc = frame.contentDocument;
        if (!doc) {
          previewError.textContent = "This browser cannot access the sandboxed preview. Source and exact downloads remain available.";
          previewError.hidden = false;
          return;
        }
        pane.loaded = true;
        doc.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "light";
        // Frozen popup coordinates were measured at capture width, not this narrower pane.
        for (const popup of doc.querySelectorAll<HTMLElement>('[role="menu"],[role="listbox"],[role="dialog"]')) {
          for (let element: HTMLElement | null = popup; element && element !== doc.body; element = element.parentElement) {
            const position = frame.contentWindow!.getComputedStyle(element).position;
            if (position !== "fixed" && position !== "absolute") continue;
            element.style.setProperty("position", "relative", "important");
            element.style.setProperty("inset", "auto", "important");
            element.style.setProperty("transform", "none", "important");
            element.style.setProperty("translate", "none", "important");
            element.style.setProperty("max-width", "100%", "important");
          }
        }
        doc.addEventListener("click", event => event.preventDefault(), true);
        doc.addEventListener("submit", event => event.preventDefault(), true);
        doc.addEventListener("keydown", event => {
          if (event.key === "Escape") { event.preventDefault(); dialog.close(); }
        });
        doc.querySelectorAll("input,select,textarea,button,a,summary,[contenteditable],[tabindex]").forEach(element => {
          element.setAttribute("tabindex", "-1");
          element.setAttribute("inert", "");
        });
        frame.contentWindow?.addEventListener("scroll", scheduleArrow, true);
        paint(pane, true);
      });
      frame.srcdoc = pane.preview.document;
      return pane;
    }
    function populate(): void {
      observer?.disconnect();
      panes?.forEach(pane => pane.sourceViewer.destroy());
      dialog.replaceChildren();
      selectedGoal = undefined;
      panes = undefined;
      const state = data.states.find(state => state.id === result.stateId);
      if (!state) throw new Error(`Missing captured state: ${result.stateId}`);
      const top = node("header", "", "bench-inspector-header");
      const title = node("h2", "Compare representations");
      title.id = "inspector-title";
      const select = node("select");
      select.setAttribute("aria-label", "Comparison result");
      for (const item of data.results) {
        const option = node("option", `${label(item.stateId)} / ${label(item.profileId)}`);
        option.value = item.id;
        option.selected = item.id === result.id;
        select.append(option);
      }
      select.addEventListener("change", () => {
        const next = data.results.find(item => item.id === select.value);
        if (!next) return;
        result = next;
        populate();
        dialog.querySelector<HTMLSelectElement>('select[aria-label="Comparison result"]')?.focus();
      });
      top.append(title, select, button("Close inspector", () => dialog.close()));
      const layout = node("div", "", "bench-inspector-layout");
      const sidebar = node("aside", "", "bench-goals");
      sidebar.setAttribute("aria-label", "Goal inspection");
      sidebar.append(node("h3", `Goals · ${ratio(result, "overall")} retained`));
      const list = node("div", "", "bench-goal-list");
      goalButtons = result.goals.map(goal => {
        const control = button("", () => chooseGoal(goal), "bench-goal");
        control.dataset.goalId = goal.id;
        control.dataset.match = goal.match;
        control.append(node("span", goal.passed ? goal.match === "inferred" ? "Retained (inferred)" : "Retained" : "Missing", `bench-status ${goal.passed ? "pass" : "fail"}`),
          node("span", goal.description), node("small", goal.category));
        list.append(control);
        return control;
      });
      goalDetails = node("div", "", "bench-goal-details");
      sidebar.append(list, goalDetails);
      comparison = node("div", "", "bench-comparison");
      const svgNamespace = "http://www.w3.org/2000/svg";
      arrow = document.createElementNS(svgNamespace, "svg");
      arrow.classList.add("bench-connector");
      arrow.setAttribute("aria-hidden", "true");
      const defs = document.createElementNS(svgNamespace, "defs");
      const marker = document.createElementNS(svgNamespace, "marker");
      marker.id = "bench-arrowhead";
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "9");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerWidth", "7");
      marker.setAttribute("markerHeight", "7");
      marker.setAttribute("orient", "auto");
      const triangle = document.createElementNS(svgNamespace, "path");
      triangle.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      triangle.classList.add("bench-arrowhead");
      marker.append(triangle);
      defs.append(marker);
      path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("marker-end", "url(#bench-arrowhead)");
      arrow.append(defs, path);
      panes = [createPane("raw", state), createPane("output", state)];
      comparison.append(...panes.map(pane => pane.element), arrow);
      layout.append(sidebar, comparison);
      dialog.append(top, layout);
      observer = new ResizeObserver(scheduleArrow);
      observer.observe(comparison);
      if (result.goals[0]) chooseGoal(result.goals[0]);
    }
    dialog.addEventListener("close", () => {
      observer?.disconnect();
      panes?.forEach(pane => pane.sourceViewer.destroy());
      if (pending) cancelAnimationFrame(pending);
      dialog.remove();
      if (trigger.isConnected) trigger.focus();
    }, { once: true });
    root.append(dialog);
    populate();
    dialog.showModal();
    scheduleArrow();
  }
}

function startDashboard(suite: ViewerSuite, root: HTMLElement, standaloneHTML: string): void {
  let grouping: "config" | "stack" = "config";
  let selectedKey: string | undefined;
  const percent = (value: number | null) => value === null ? "N/A" : `${(value * 100).toFixed(1)}%`;

  function openCell(cell: ViewerData, profile?: string): void {
    start(cell, root, standaloneHTML, suite, () => {
      render();
      root.querySelector<HTMLButtonElement>(grouping === "config" ? '[data-grouping="config"]' : '[data-grouping="stack"]')?.focus();
    }, profile);
  }

  function table(rows: AggregateRow[], title: string, activate: (row: AggregateRow) => void, firstColumn: string): HTMLElement {
    const scroller = node("div", "", "scroll");
    const table = node("table", "", "bench-aggregate-table");
    table.setAttribute("aria-label", title);
    const head = node("thead"), header = node("tr");
    [firstColumn, "Samples", "Mean retention", "Mean semantic", "All goals retained", "Mean output KB", "Mean size vs raw", ""]
      .forEach(text => header.append(node("th", text)));
    head.append(header);
    const body = node("tbody");
    const maximum = Math.max(0, ...rows.map(row => row.stats.meanBytes));
    for (const group of rows) {
      const row = node("tr");
      row.dataset.aggregateKey = group.key;
      if (group.key === selectedKey) row.classList.add("bench-focused-result");
      const name = node("td");
      name.append(button(label(group.label), () => activate(group), "bench-text-button"));
      const stats = group.stats;
      const retention = node("td", percent(stats.meanRetention));
      retention.title = `${stats.retainedGoals} / ${stats.requiredGoals} goal occurrences; displayed percentage averages each sample's retention equally.`;
      const size = sizeBar(stats.meanBytes, maximum);
      const sizeCell = node("td", "", "bench-size-cell bench-numeric");
      sizeCell.title = `${size.kb} KB mean per sample; bar scaled to the largest mean in this table (${(maximum / 1000).toFixed(3)} KB).`;
      sizeCell.setAttribute("aria-label", sizeCell.title);
      const track = node("span", "", "bench-size-track");
      track.setAttribute("aria-hidden", "true");
      const bar = node("span", "", "bench-size-bar");
      bar.style.width = `${size.percentage}%`;
      track.append(bar);
      sizeCell.append(track, node("span", size.kb, "bench-size-value"));
      const drill = node("td");
      drill.append(button("Drill down", () => activate(group)));
      row.append(name, node("td", String(stats.samples)), retention, node("td", percent(stats.meanSemantic)),
        node("td", `${stats.fullFidelity} / ${stats.samples}`), sizeCell, node("td", percent(stats.meanRawRatio)), drill);
      body.append(row);
    }
    table.append(head, body);
    scroller.append(table);
    return scroller;
  }

  function render(): void {
    root.replaceChildren();
    const heading = node("header", "", "bench-heading");
    const text = node("div");
    text.append(node("p", "D2SNAP / PERCEPTION BENCH", "eyebrow"), node("h1", "Benchmark dashboard"),
      node("p", `${suite.cells.length} implementations / ${suite.cells.reduce((sum, cell) => sum + cell.states.length, 0)} captured states`, "muted"));
    const actions = node("div", "", "bench-actions");
    actions.append(button("Download standalone HTML", () => download("perception-bench.html", standaloneHTML, "text/html;charset=utf-8")),
      button("Theme", () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; }));
    heading.append(text, actions);
    const navigation = node("nav", "", "bench-navigation");
    navigation.setAttribute("aria-label", "Aggregate results by");
    for (const [mode, title] of [["config", "By configuration"], ["stack", "By stack"]] as const) {
      const control = button(title, () => { grouping = mode; selectedKey = undefined; render(); root.querySelector<HTMLButtonElement>(`[data-grouping="${mode}"]`)?.focus(); });
      control.dataset.grouping = mode;
      control.setAttribute("aria-pressed", String(grouping === mode));
      navigation.append(control);
    }
    const scope = node("p", grouping === "config"
      ? "Each sample is one implementation and state at this configuration. Raw is a separate baseline."
      : "Each sample is one implementation, state and numeric configuration. Raw baselines are excluded from these stack averages.", "muted bench-dashboard-scope");
    root.append(heading, navigation, scope);
    const groups = aggregateResults(suite.cells, grouping);
    root.append(table(groups, grouping === "config" ? "Results by configuration" : "Results by stack", group => {
      if (grouping === "stack" && aggregateCells(group.samples).length === 1) openCell(group.samples[0]!.cell);
      else { selectedKey = group.key; render(); root.querySelector<HTMLElement>("#aggregate-drill-title")?.focus(); }
    }, grouping === "config" ? "Configuration" : "Stack"));
    const details = node("details", "", "bench-aggregate-method");
    details.append(node("summary", "How aggregates are calculated"),
      node("p", "Retention and semantic percentages are arithmetic means of per-sample goal fractions, so a five-goal state does not outweigh a three-goal state. Mean output KB uses exact UTF-8 bytes / 1000. Size vs raw averages each sample's ratio to its own raw capture. N/A ratios are excluded; sample counts expose coverage. These are descriptive comparisons of this corpus, not framework rankings."));
    root.append(details);
    const selected = groups.find(group => group.key === selectedKey);
    if (selected) {
      const section = node("section", "", "bench-aggregate-drill");
      const title = node("h2", grouping === "config" ? `Configuration ${label(selected.label)} by stack` : `${label(selected.label)} implementations`);
      title.id = "aggregate-drill-title";
      title.tabIndex = -1;
      section.append(title, table(aggregateCells(selected.samples), "Selected aggregate by implementation",
        group => openCell(group.samples[0]!.cell, selected.profileId), "Implementation"));
      root.append(section);
    }
  }
  render();
}

try {
  const root = document.getElementById("bench-viewer");
  const payload = document.getElementById("bench-data");
  if (!root || !payload?.textContent) throw new Error("Report data is missing.");
  const data = JSON.parse(payload.textContent) as ViewerData | ViewerSuite;
  const standaloneHTML = `<!doctype html>\n${document.documentElement.outerHTML}`;
  if ("cells" in data) {
    if (!data.cells.length) throw new Error("Matrix report has no cells.");
    startDashboard(data, root, standaloneHTML);
  } else start(data, root, standaloneHTML);
} catch (error) {
  console.error("Report initialization failed", error);
  const alert = node("p", `Report could not initialize: ${error instanceof Error ? error.message : String(error)}`, "notice");
  alert.setAttribute("role", "alert");
  (document.getElementById("bench-viewer") ?? document.body).prepend(alert);
}
