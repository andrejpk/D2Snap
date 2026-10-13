# Perception Bench

Retain required page content and control information while minimizing D2Snap
output size. **The records POC registers five framework/library implementations,
each with the same two states and success goals.** Request-form and request-detail
implementations remain planned. The POC uses Playwright directly and a local HTML/JSON report, not yet
Playwright Test's report UI.

## Start here

Use Node 24+ and pnpm 10.6.0. From the repository root:

```powershell
pnpm --dir bench install --frozen-lockfile
pnpm --dir bench check
pnpm --dir bench matrix
```

This is a **bench-local pnpm workspace**. One lockfile covers its packages and
future `stacks` apps. pnpm shares package contents through its store while keeping
package dependency boundaries explicit. The library's root npm/package-lock
setup and existing evaluation commands are unchanged.

Node's test runner executes TypeScript directly; TypeScript checks it separately.
The foundation tests do not need installed browsers or an LLM API key.
`check` also typechecks available stack apps.

## Run the small POC

```powershell
pnpm --dir bench exec playwright install chromium --only-shell
pnpm --dir bench demo
pnpm --dir bench serve
```

Open **http://127.0.0.1:4177/** for the report.
The default `demo` runs all registered records cells and publishes one standalone
matrix report. Its dashboard toggles **By configuration / By stack**, with
drill-down into the existing per-stack summary and inspector. Configuration
aggregates include Raw separately; stack aggregates exclude Raw. Means weight
each implementation/state/configuration sample equally, show coverage counts,
and do not claim a framework ranking. A Back to dashboard button preserves the
chosen grouping. Per-stack summaries retain the **Framework stack** selector.
Each cell also has an isolated
report and fixture manifest under `reports\latest\cells\<stack>.<case>.<variant>`.
Raw goals must pass before a cell can join a successful matrix report.

| Stack | Records presentation |
| --- | --- |
| React + shadcn/Radix | Icon selection toolbar |
| Angular + Material + AG Grid Community | Enterprise operations grid and selection toolbar |
| React + Fluent UI v9 | Enterprise case console and command toolbar |
| Vue + PrimeVue | Administrative DataTable with row popup actions |
| Svelte + Bits UI + Tailwind | Record cards with contextual menus |

All components use free/community packages. Native framework/component DOM is
intentional; there are no stack-specific scorer exemptions.

```powershell
pnpm --dir bench demo --stack react-fluent
pnpm --dir bench demo --all
pnpm --dir bench serve --stack vue-primevue --port 4180
```

Use `--stack` to run one implementation, or to serve its saved live fixture on a
separate port. A matrix report's cell link opens the corresponding frozen report;
it does not pretend a different stack is the default server's live fixture.
The performance table focuses on content/control retention and KB, not cache
hits. Inspect a result in a full-screen comparison: raw captured DOM and rendered
D2Snap output side by side, with selectable goals and exact-source views.
Source mode shows formatted HTML in a read-only, syntax-highlighted code viewer
with line numbers and fold gutters, without an outline or extra toolbar. Formatting is
display-only. Invalid HTML
shows an explicit formatter diagnostic and keeps the original source available.
Downloads and size/retention measurements always use the exact original bytes.
The configuration explorer explains the saved profiles and exposes their complete
options and attribute scores. It does not execute a new experiment.

The primary goal counts include bounded deterministic inference. **Semantic**
shows strict HTML/ARIA retention under the same contract. Inferred matches are
labeled in the inspector with the exact rule: hybrid-table recovery, adjacent
control labels, or explicitly typed person-name initials. No model is used.
The records contract now requires enabled search/filter controls and retained
status choices. Reader v5 also recognizes bounded selected-record action context:
a sole selected row plus a matching immediate selection cue identifies the
adjacent action group, without accepting a matching button elsewhere on the page.
Reader v5 and contract revision 3 invalidate assessments
automatically; unchanged captures and D2Snap outputs remain reusable.

Green rendered boxes identify elements supporting a passing evidence alternative.
Amber dashed rendered boxes are context, not proof of a complete match; missing or
ambiguous locations are not invented. Connecting arrows are visual aids, not
additional scoring evidence. Hybrid Markdown inside HTML is rendered for
readability, including the root README's examples; verdicts still come from the
versioned evidence reader, not that richer visual preview.

Selecting a goal also highlights its source in the formatted code panes and
opens folds hiding the location. Continuous green backgrounds identify mapped matches;
amber backgrounds identify context, without per-line borders. Complete source
lines form one continuous region; partial-line ranges remain text-bounded.
Source tooltips preserve explicit or
inferred provenance. Generated Markdown elements may map only to a containing
source block, which is marked as context rather than an exact source match.
When no truthful location exists, the pane reports it instead of highlighting
unrelated text. These display-only mappings do not alter scoring or downloads.
Frozen menus/dialogs are reflowed inside rendered inspector panes rather than
reusing desktop popup coordinates that could place them outside the narrower
view. Captured screenshots and source retain their original layout information.

**`bench\reports\latest\index.html` is a standalone artifact.** Copy that one
file anywhere and open it directly: scripts, styles, screenshots, preview
documents, the CodeMirror viewer and HTML formatter, and result data are embedded,
with no CDN, fetch, or server dependency.
Raw/output/JSON downloads are generated from that embedded data. Captured markup
is sanitized and rendered in script-disabled, network-blocked frames. The live
React fixture itself still needs the optional local server; it is not bundled
into the report as executable application code.

```powershell
pnpm --dir bench report
```

This rebuilds only the interactive HTML from saved `results.json` and fixture
assets, without building, capturing, transforming, or rescoring. Run `demo` once
when introducing a new report-data schema. Cache details remain available as
technical provenance rather than D2Snap quality metrics.
`report --all` explicitly rebuilds the last saved matrix snapshot (`suite.json`)
if a later single-stack run replaced the main report.

Select any request in the live fixture to expose its icon toolbar.

This first fixture uses an official shadcn table adaptation with Clawpilot CSS,
plus real Radix Toolbar/Dialog components. It does not yet exercise Tailwind's
utility-class output. Source provenance and license are included in the stack
package; results describe this implementation, not all shadcn applications.

The run covers `browsing` and `target-actions-available`, each with a raw baseline
and ten uniform profiles from [configs/poc.json](configs/poc.json), displayed as
**Raw, 0.1, 0.2, through 1.0**, for 22 report rows per cell (110 across five cells). Each numeric profile sets
`rE`, `rA`, and `rT` to its displayed level, matching the repository's uniform
reduction evaluation. Higher numbers mean more requested reduction, not higher
fidelity. Raw bypasses D2Snap; all numeric profiles still run enabled preprocessing.
The original custom probe presets are not part of this comparison.

Output KB cells include background bars scaled by exact bytes against the
largest output in the same state, including Raw. The maximum is 100%; numeric
level 1.0 is not assumed to be largest. Tooltips and accessible labels explain
the scale. All-zero comparisons show empty bars.
Negative scores remain visible findings. An incomplete raw baseline is flagged
as a fixture/acquisition/reader issue, not attributed to compression.

```powershell
pnpm --dir bench demo --assert-cached
pnpm --dir bench demo --refresh
pnpm --dir bench test:browser
```

An unchanged `--assert-cached` run requires zero builds, browser launches,
captures, transforms, and assessments; it regenerates the report from cached
artifacts. `--refresh` makes fresh observations without replacing canonical
cached results. Browser tests exercise live-property capture, inert replay, byte-for-byte
repeatability of fresh POC observations, zero-work warm runs, and the standalone
report's inspector, source downloads, and configuration explorer with networking
disabled. They run serially because the POC checks publish to the same report folder.
These two flags cannot be combined.

**There is no runtime LLM or model-based judge.** The coding agent authors code;
the inner loop is ordinary TypeScript, Playwright, D2Snap, and explicit contract
checks. Browser dependencies/revisions, locale, timezone, viewport, clock, and
random seed are fixed. Capture permits only its local fixture server; replay
blocks network and fixture scripts. Timing is not a deterministic score.

Playwright is pinned to 1.58.2 with its bundled Chromium revision, not a floating
system browser. This revision was available locally when a newer browser
download timed out. Installation may access package/browser registries; the
benchmark has no external runtime service dependency.

The runner measures **current-worktree D2Snap source**, bundling its runtime
dependencies from the bench lockfile without changing the root npm installation.
At library revision `591681a577d0ce3c66ad7187a806d75125d8abf7`, the API uses
`groundTruth` rather than `attributeScoring`/`liftImageDescription` options.
The bench-only `src\runner\subject-options.ts` adapter maps the explicit score
table/fallback into `groundTruth.typeAttribute`, and image-label lifting into
`groundTruth.typeElement.replaceWithLabel`. Library element-category defaults
remain intact, class-pattern inference stays disabled unless explicitly added
to the bench configuration contract, and resolved options plus adapter code are
included in cache identity. No library source changes are required.
Change source or supply `--config configs\my-probe.json` to rerun affected stages.
Ref/branch materialization, paired historical comparison, additional cells,
authoring skills, and Playwright Test integration remain future work.

Reports live in `bench\reports\latest`; immutable stage artifacts live in
`bench\.cache\artifacts`. Both are ignored by Git. The preview server is bound
only to loopback; stop it with Ctrl+C.

## Standardize the UX cases first

The UX-case axis defines the task, fixed dataset revision, states, required
information, excluded clutter, and independent success goals. The stack axis
defines the framework/library combination. A **presentation variant** describes
the UI paradigm: direct text actions, icon toolbars, overflow actions, and so on.
An implementation is identified by case + stack + variant. It supplies a
setup/ready adapter, never different ground truth.

The initial corpus is:

| UX case | States |
| --- | --- |
| [Browse purchase requests](cases/records.ts) | Browsing; target actions available |
| [Request form](cases/request-form.ts) | Initialized; validation errors |
| [Request detail](cases/request-detail.ts) | Details available; approval review |

Each case owns its states and requirements in a separate file. Common helpers
and defaults live in `cases\helpers.ts`; `src\matrix.ts` only
assembles the registry and re-exports the cases.

The initial sampling plan pairs React + shadcn/Radix with icon toolbars,
Angular + PrimeNG with direct text actions, and Vue + Vuetify with overflow
actions. These are editable sampling choices, not restrictions on those stacks.
`pnpm matrix` shows the complete sampling plan, with
five records cells registered. The original Angular/PrimeNG and Vue/Vuetify
sampling plans remain available for future work; including those planned axes,
the registry has 21 implementation plans and 42 state cases.
Add another variant for any case/stack without duplicating its app package or
oracle. Registration means an adapter is declared, not that it has passed.

### Goals, not widget prescriptions

For example, the records case requires **"Access the details of RQ-1042"**, not
"find an Actions button inside a table row." Its evidence alternatives accept a
row link, a card action, a contextual toolbar, or a popup linked to the target
row. Names such as "View details" and "Open request" are explicitly reviewed
equivalents, not fuzzy matches.

Every goal contains `evidence` alternatives, each with an `id` and `allOf`
checks. One complete alternative satisfies the goal once; partial checks from
different alternatives cannot be combined. All implementations are evaluated
against the same alternatives and denominator. The scorer reports which
alternatives matched, without receiving a stack or variant exemption.

The independent controls cover tables versus cards, text actions versus named
image buttons, selected-record toolbars versus overflow menus, different form
controls, and tabbed/dialog versus inline approval flows. Missing labels or
lost target associations still fail unless a documented evidence rule establishes
them. This is bounded output-only interpretation, not arbitrary visual inference.

## One harness, separate fixture data

The workspace has seven projects: the **harness at `bench`**, the small
**scenarios package**, and **five fixture apps**. Contracts, cases, evidence, and cache are ordinary harness
modules, not separate packages. The runner belongs to the same project.

| Location | Responsibility | Browser apps may import? |
| --- | --- | --- |
| `packages\scenarios` | `@perception-bench/scenarios`: shared synthetic data and fixed environment | Yes |
| `cases` | One file per UX case, with independent goals and evidence | **No** |
| `src\contracts.ts` | Validated case/state, evidence-rule and adapter types | Types only |
| `src\matrix.ts` | Stack/variant registry and implementation plans | **No** |
| `src\evidence` | Output-only scoring and exact UTF-8 size | **No** |
| `src\cache` | Canonical identities and immutable result reuse | **No** |
| `src\runner` | POC build, capture/replay, cached orchestration and reporting | **No** |
| `tests` | Independent controls and harness tests, grouped by responsibility | **No** |

Apps live under `stacks\<stack-id>`, one project per framework/library
combination, not per case or variant. Each app declares its own UI dependencies
and imports `@perception-bench/scenarios` with `workspace:*`. All projects are
private. Do not enable global hoisting or add every UI library to the harness.

An authoring agent reads the chosen case, stack/variant plan, shared data, and
[authoring guidance](AUTHORING.md), then builds the UI and a state adapter.
The adapter turns `preparation` and `readyWhen` prose into framework-specific
Playwright setup/readiness checks; the scorer already reads `requirements`
directly as data. The agent may read the oracle, but the browser app must not
bundle it. The five registered records adapters are implemented; reusable authoring skills
and adapters for the other UX cases remain future work.

## Scope of the measurements

Required goals have `content` or `control` categories. A goal passes only when
one complete expression retains its facts, state and relationships. Wrong-row
values, ambiguous controls and missing error associations must not pass because
the same text exists elsewhere. Explicit and inferred evidence remain distinguishable.

Size is measured on the exact returned output with UTF-8 bytes and decimal KB.
Smaller is better **at equal retention**; empty output is not an improvement.
There is no universal model-token count, so tokens are not a phase-one metric.

The scorer's positive representations are deliberately small native HTML and
Markdown controls, not generated application fixtures or measured D2Snap results.
They test the oracle independently of a UI library. The POC separately captures
and scores the real React fixture. Artifact building from refs and fine-grained
dependency-closure discovery remain later phases.

The [evidence reader](src/evidence/README.md) documents its supported
grammar and limits. Its declared HTML versus mixed Markdown/HTML format is
assessment metadata, not an option to tune for a better score.

The cache module implements canonical stage keys, comparison pairing, and a
local integrity-checked store. The POC supplies conservative source/build/config
manifests, including a case/stack/variant implementation hash for capture and
comparison. Presentation changes cannot masquerade as code/config-only
comparisons, even if output bytes happen to match. Storage assumes a trusted
local filesystem with hard-link support;
abandoned producer locks time out explicitly rather than being deleted unsafely.

See [AUTHORING.md](AUTHORING.md) for the row/column expansion workflow and
[DESIGN.md](DESIGN.md) for the research, cache protocol, and larger POC plan.
