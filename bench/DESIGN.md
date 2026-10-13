# Perception Bench: research and POC design

Status: foundations plus a small runnable records/React/icon-toolbar slice
implemented on 2026-09-16. The broader matrix and ref-comparison workflow remain
planned. See README.md and AUTHORING.md for the concrete quick start and layout.
Date: 2026-09-15.

## 1. Goal and boundaries

Find the smallest D2Snap representation that still contains the important UI
elements and information needed for content extraction and UI automation.
Modern applications often render deeply nested divs/spans, generated classes,
headless components, or partially labeled controls. The benchmark must expose
where D2Snap preserves meaning, loses it, or never receives it in its input.

Two independent workflows live under `bench`:

1. **Author the corpus:** coding-agent skills and scaffolding add framework/UI
   stacks and page UX templates, including independently defined ground truth.
2. **Run experiments:** deterministic tooling measures the same corpus against
   D2Snap artifacts and configurations, reuses unchanged work, and compares
   explicitly selected experimental variables.

For the POC, success means **extraction fidelity versus output size**: did the
output retain all required content and control information, and how small is
it? The user explicitly confirmed this extraction-only focus. Control labels,
values, states, and associations are information to retain, not actions an agent
must execute to earn a score.

Use deterministic assertions, not model calls or an LLM judge. Browser actions
only prepare and validate fixture states. Do not score click completion,
navigation success, or end-to-end task success.

Playwright and D2Snap are complementary here. Playwright loads the real app,
opens menus/dialogs as prescribed, and captures the input. D2Snap reduces that
input. The scorer measures retained information and output size. Playwright can
also expose DOM/accessibility snapshots, but an accessibility snapshot is not
the D2Snap input or a competing compression subject in this POC. Do not pre-trim
the page to required elements before passing it to D2Snap.

Non-goals: backends, authentication, production customer data, cross-browser
coverage, mobile layouts, full agent trajectories, screenshots as model input,
canvas/chart interpretation, and a hosted reporting service.

## 2. Research: choosing a representative portfolio

### 2.1 Adoption evidence

Percentages below are respondent-level, multi-select measures. They are not
shares of companies, enterprise deployments, or public websites.

| Source | Relevant results | Meaning and limitations |
| --- | --- | --- |
| Stack Overflow 2025, professional developers [1] | React 46.9%; Angular 19.8%; Vue 18.4%; Svelte 6.9% | Extensive development in the preceding year; 19,460 respondents to this question. Professional developers are not exclusively enterprise developers. |
| State of JS 2025 [2] | React 85%; Vue 52%; Angular 48%; Svelte 27% | Have-used ratios, not current-project share. Self-selected frontend audience; 13,002 responses overall. Results published in February 2026. |
| State of React 2025 [3] | MUI 57%; shadcn/ui 56%; Radix 47%; React Bootstrap 30%; Ant Design 28% | Have-used ratios; about 2,770 responses per library. shadcn and Radix overlap, including within one app. |
| State of Vue 2025 [4] | 96% had worked with Vue 3; 56.1% used utility-first CSS such as Tailwind | 1,428 professional responses collected in late 2024. Includes a business application case using Vuetify, not a comparative library market-share estimate. |

State of React 2025 collected responses into January 2026. Its About page has
an inconsistent publication-year field, so this design does not rely on that
publication date. The smaller response pool than 2024 also limits longitudinal
comparisons.

No defensible enterprise-specific market-share table was found. No verified
contemporary survey ranking Angular Material against PrimeNG, or Vuetify against
Element Plus, was obtained. Public-site detection under-observes authenticated
internal applications. Satisfaction and intent rankings must not replace usage
evidence.

The evidence supports React-first coverage, meaningful Angular and Vue
representation, and smaller-framework extensions. Established apps also matter:
Stack Overflow reports jQuery at 24.1% among professional respondents [1].

### 2.2 Broader portfolio, beyond the POC

| Stack family | Reason to include | DOM behaviors to investigate |
| --- | --- | --- |
| React + MUI / MUI X | Strong usage; design-system customization [3, 5] | Nested slots, stable and generated classes, wrappers, virtualized grids |
| React + Ant Design | Established usage and explicit enterprise positioning [3, 6] | Dense forms, tables, popup states, repeated actions |
| React + shadcn/Radix | Strong usage and source-owned customization [3, 7] | Headless composition, utility classes, copied components, state attributes |
| Angular + Material/CDK | Official ecosystem implementation [8] | Custom hosts, projected native controls, focus-managed overlays |
| Angular + PrimeNG | Complementary data-heavy component family [9] | Editable/filterable tables, custom inputs, pass-through attributes |
| Vue 3 + Vuetify | Business-app deployment evidence [4] | Wrapped controls, forms, dialogs, tables |
| Vue 3 + Element Plus | A second Vue implementation family [10] | Alternative form, table, and select markup |

Later extensions: Svelte + Bits UI [11], React Bootstrap or jQuery/Bootstrap,
React Aria or Headless UI, and enterprise design systems such as IBM Carbon or
SAP UI5 Web Components [12]. These are coverage choices, not estimated market
shares. A native-HTML implementation can provide a positive control later;
small native snippets should already test the scorer.

Treat Next.js, Nuxt, and SvelteKit as rendering variants unless hydration,
streaming, or application state creates meaningfully different observed DOM.
Do not count the same component DOM twice merely because its application shell
has a different framework name.

### 2.3 Bespoke/internal applications

Stock component demonstrations are insufficient. Include realistic customization
without assuming that every enterprise app has poor accessibility:

- Company design-system wrappers around vendor controls.
- Headless primitives with internal styling and few recognizable library names.
- Utility-heavy, scoped, CSS-module, CSS-in-JS, and readable application classes.
- Mixed libraries, for example a different grid or editor inside a form system.
- Partial labels and custom div-based interaction patterns.
- Automation annotations present or absent independently of ARIA quality.

MUI documents customization of nested slots and generated classes [5]. shadcn
distributes editable component code; Radix composition can attach behavior to
a child without adding a DOM wrapper [7]. PrimeNG pass-through allows internal
ARIA/data attributes and custom templates can leave semantics to app authors [9].
These establish mechanisms, not the frequency of particular practices.

Measure actual DOM characteristics: node count, depth, tag mix, attribute volume,
and observed semantic coverage. Component-tree depth is not DOM depth.

### 2.4 Page patterns and observation limits

A larger portfolio would include record lists, complex forms, record/workflow
details, administration/permissions, dashboards, knowledge/support workspaces,
commerce, and booking. Six business and two consumer patterns would be an
intentional 75/25 sampling policy, not measured market share.

WorkArena's ServiceNow tasks are a useful business-workflow reference [13].
WAI-ARIA patterns provide terminology for controls and relationships [14], not
an assumption that every application implements those patterns correctly.

Virtualized grids insert and remove DOM as users scroll [5]. Unrendered records
cannot be counted as compression losses. Likewise, unlabeled canvas content,
closed shadow roots, or uncaptured frames are acquisition limitations. Report
these separately rather than rewarding invented semantics.

## 3. Agreed POC: three stacks by three page patterns

The user selected these stacks and page patterns on 2026-09-15.

| Stack ID | Implementation |
| --- | --- |
| `react-shadcn` | React + shadcn/ui table adaptation and pinned Radix primitives; first slice uses Clawpilot CSS rather than Tailwind |
| `angular-primeng` | Angular + PrimeNG |
| `vue-vuetify` | Vue 3 + Vuetify |

Pin exact package versions, lockfiles, and copied shadcn component source during
scaffolding. The names above select implementations, not floating dependencies.
Prefer supported native build tooling for each stack rather than forcing all
three into one build system.

| Page ID | UX and task context | Important content to retain | Important controls whose information must be retained | POC states |
| --- | --- | --- | --- | --- |
| `records` | Locate an overdue purchase request and access its actions | Target request ID, supplier, amount, status, owner; correct record/fact associations | Query, status filter, access target details, change target owner when available | Browsing; target actions available |
| `request-form` | Fill a purchase request and understand validation | Field labels/current values, required state, selected supplier/cost center, relevant error text and its field association | Supplier/cost-center controls, amount field, date control, submit; relevant invalid/disabled state | Initialized form; validation errors after invalid submit |
| `request-detail` | Read the target request and prepare an approval | Request identity, supplier, amount, status, and target-specific review facts | Access history, start approval, confirm/cancel review with applicable state | Details available; approval review |

This is initially nine planned implementations and eighteen independently
identified state cases. State names describe the user's goal, not a mandatory
menu, tab, or dialog. Unavailable actions/review content are not required before
their corresponding state. Additional states must be explicit, never silently
included in the denominator.

Presentation is a separate identity: **case + stack + variant**. The initial
sampling plan uses React/shadcn icon toolbars, Angular/PrimeNG text actions, and
Vue/Vuetify overflow actions. These are sampling choices, not library limits.
One stack app can render multiple variants of each case without duplicating its
dependencies or oracle. Add matched variants within a stack when isolating
presentation effects; this mixed POC cannot attribute every difference solely
to its framework.

Use shared synthetic domain data, tasks, viewport, locale, and state recipes.
Let each library render its own normal DOM. Every page includes realistic
application chrome, footer/help links, unrelated records, decorative icons, and
other distractors. None of those is a positive success requirement unless the
task genuinely depends on it.

POC fixture requirements:

- No backend or external runtime network dependencies; serve local assets.
- Production builds, a pinned Chromium revision, fixed locale/timezone,
  deterministic data/clock, reduced motion, and explicit ready/state assertions.
- Capture only after the state recipe has completed; do not rely on arbitrary
  sleeps or network-idle alone.
- At least one repeated action label, opaque/custom class naming, and nested
  wrapper structure across the corpus. Preserve each library's stock semantics;
  deliberately degraded implementations are a later, separately labeled axis.
- Synthetic requests and approvals never affect external systems.

## 4. Ground truth and scoring

### 4.1 Page contract, stack adapter, and evidence

Keep a framework-independent page/state contract in TypeScript. Each required
item has a stable logical ID, category (`content` or `control`), and a `goal`.
Its `evidence` lists named equivalent alternatives. Each alternative has `allOf`
checks for facts, required state, affordances, and relationships. A control
alternative always requires control evidence, never just matching text.

For example, accessing a target request can be expressed through a row link,
card action, selected-record toolbar, or linked popup. Equivalent captions and
roles are explicitly reviewed in the shared contract, not guessed or selected
by stack. An image button still needs an interpretable name, and every action
must retain its association to the target.

Each case/stack/variant adapter separately supplies live-page locators and setup actions.
Those locators validate that the fixture implements the contract. They are
**not** required to survive compression and are never used as a substitute for
checking output.

Example requirements for one record:

| Logical ID | Required evidence |
| --- | --- |
| `target-request` | Request ID and supplier remain associated with the target record |
| `target-amount` | Correct amount/currency remain associated with that record, not merely somewhere in output |
| `target-actions` | An identifiable action affordance is associated with the target record |
| `approve-confirm` | In the approval-review state, confirmation control, purpose, and relevant enabled state remain identifiable, whether review is modal or inline |

An item passes once if all checks in any one alternative pass. Do not combine
partial alternatives or count multiple matches as multiple successes. Record
alternative/sub-check outcomes for diagnosis; do not hide a lost target
association behind successful substring matches. Variants share the same goal
IDs and denominator, with no implementation-specific exemptions.

This adjustment is contract schema 2 and corpus revision 2. Old single-rule
oracles are rejected; old and new truth are not comparable as a D2Snap-only
experiment. Reader v3 supports these alternatives and explicit relationship
rules, not general visual or natural-language understanding.

For controls, preserve an interpretable name/purpose, affordance, state, and
context. Native tags, explicit roles, or a future documented inferred-control
representation can provide evidence. For a roleless custom widget, text alone
does not establish actionability; report the missing evidence honestly.

### 4.2 No ground-truth leakage

Oracle files, logical target IDs, and expected answers remain outside fixture
bundles and outside the representation delivered to an agent. Do not insert
test-only semantic attributes, label correct targets with unique hints, or
increase their D2Snap attribute scores to make tests pass.

Existing natural application labels and library attributes are legitimate
input. Authoring provenance is metadata, not a hint embedded into the page.

A future grounding experiment may assign neutral IDs consistently to all
eligible nodes, not only correct targets. It must be a separate declared input
condition and include ID overhead in its size measurement.

### 4.3 Output-only scoring

The scorer consumes the exact delivered D2Snap text plus the independent
oracle. It must not consult the original DOM to recover information absent from
the output. Live DOM is allowed only for fixture/acquisition validation.

D2Snap can emit mixed HTML and Markdown. Use an explicit, versioned evidence
reader for that representation, not a requirement for original CSS paths or
unchanged wrapper structure. Contract authors define acceptable equivalent
evidence and scoped relationships. Ambiguous matches fail; raw substring
presence is insufficient for repeated labels, values, and row actions.

The implemented reader accepts a producer-declared format: `html` for raw HTML
and `html-markdown` for mixed output. The format must accompany the reader
version/content hash in assessment identity. This avoids treating indentation
in known HTML as Markdown code, without guessing formats or selecting whichever
earns a better score. Bytes are always measured before parsing.

Before scoring real output, exercise each contract against:

- A lossless control representation with all required information.
- Equivalent, differently formatted HTML/Markdown evidence.
- Missing labels, missing states, wrong row association, duplicate labels,
  contradictory values, and empty output.

This bounds what deterministic scoring can claim. It does not establish
general natural-language comprehension or end-to-end agent success.

### 4.4 Metrics and decision policy

| Metric | Definition |
| --- | --- |
| Required-item retention | Passing required items / all required items for this state |
| Content retention | Passing required content items / all required content items for this state |
| Control-information retention | Passing required control-information items / all required control-information items for this state; no action execution |
| Full fidelity | All required items, including required relationships/states, pass |
| Output bytes | `Buffer.byteLength(output, "utf8")` on the exact delivered text |
| Output KB | Output bytes / 1000; always label the unit explicitly |
| Size ratio | Output bytes / raw input bytes from the same capture protocol |
| Diagnostics | Per-item failures, artifact/config identity, cache provenance, and infrastructure errors |

Keep quality and size separate. Prefer smaller output at equal coverage; show
the quality/size Pareto frontier for other tradeoffs. Do not create a weighted
score where empty output can win by being small. Clutter is penalized through
size, not by requiring it to survive. An exhaustive negative inventory is not
available, so do not label this metric "precision."

Report individual cases and equal-weight page/stack summaries, not only a
pooled item count that lets the largest form dominate. Show numerator and
denominator. A state with no items in one category has an N/A category result.
Infrastructure/acquisition failures are explicit failed or unscorable cases,
never zero-byte successes or silently omitted rows.

### 4.5 Tokens

**KB is the primary cross-model metric for the POC.** There is no universal token
count that translates reliably across most model families. OpenAI's tiktoken
uses particular model encodings [17]; JS/WASM and pure-JS ports exist [18].
Different tokenizers can produce different counts and even different rankings
for markup, Unicode text, and generated class strings.

An optional later metric can use a pinned local tokenizer/encoding, labeled
explicitly, for example `tokens_o200k_base`. Record implementation version and
encoding/rank-data hash in the measurement key. It is a reference-token count,
not a Claude/Gemini/universal estimate. Do not call provider APIs merely to count
tokens. Retokenizing existing outputs must not rerun D2Snap.

D2Snap's current length/4 token estimate may be retained as a diagnostic but
must not substitute for measured KB or a named tokenizer. Count only snapshot
content here; any future task prompt, ID mapping, or other delivered context
must also be accounted for in an agent-input metric.

## 5. Execution/reporting framework decision

**Recommendation: Playwright Test plus a thin TypeScript content-addressed
artifact cache.** Reuse the repository's Playwright, TypeScript, esbuild, and
Zod ecosystem where appropriate. The root package has `playwright`, not an
explicit `@playwright/test` dependency; add a compatible pinned test-runner
dependency during implementation, not as part of this documentation change.

The first runnable slice deliberately uses Playwright's library directly with
a standalone interactive HTML/JSON report. It covers one stack/case/variant, two states,
four D2Snap profiles and two raw baselines. This avoids introducing Playwright
Test configuration before the capture protocol is exercised. Its future report
integration below remains a recommendation, not an implemented capability.

The report embeds its client script, styles, screenshots, data, and sanitized
rendered previews in one HTML file. It opens offline without a host or SPA
router. Result inspection pairs raw/output views with goal-level match/context
highlights; configurations have a separate read-only explorer. Richer rendering
of Markdown nested in HTML is a display convenience, not a change to the
evidence reader or measured bytes. Cache provenance is excluded from the
performance table. Report-only rebuilding does not rerun benchmark stages.

| Option | What it supplies | Decision |
| --- | --- | --- |
| Playwright Test | Browser fixtures, isolation, parameterized tests/projects, HTML/JSON reporting, attachments, traces, CI support [15] | Use for fixture validation, capture misses, and reportable case evaluation |
| Promptfoo | Eval comparisons, JS/TS custom providers, assertions, API-response caching [16] | Reconsider for a later LLM/agent layer; not needed for deterministic DOM preservation |
| New hosted platform or distributed task system | Potential dashboards and remote caching | Out of scope; unnecessary operational and integration cost for 18 states |

Playwright projects/dependencies are execution configuration, **not durable
content-addressed result memoization**. Promptfoo's documented cache is centered
on provider requests/configuration, with TTL behavior; it does not automatically
discover fixture source, D2Snap build, browser, and oracle dependencies. Either
choice would still need this benchmark's identity protocol.

Keep the missing cache functionality small: Node crypto, canonical manifests,
JSON results, immutable output files, atomic writes, and a filesystem lookup.
No database, remote service, or general-purpose DAG engine is required for the
POC. Separate stages so future storage changes do not affect scoring.

Reporting:

- Use Playwright's HTML report for case failures, attachments, captured input,
  output, score JSON, and failure traces/screenshots.
- Use its JSON reporter plus a small TypeScript comparison command for a
  tabular baseline/candidate summary: coverage, KB, deltas, missing items, and
  cache status.
- Attach the comparison summary to the report; do not promise a built-in
  historical Pareto dashboard that Playwright does not provide.
- Cached cases still appear with their stored verdict, measurements, and
  artifacts. They are not merely skipped tests or unconditional passes.

## 6. Artifact pipeline and cache identity

### 6.1 Stages

1. **Resolve/build fixtures:** materialize a pinned production app artifact.
2. **Validate/capture:** execute the state recipe and create an immutable input.
3. **Transform:** run a specified D2Snap artifact with a specified configuration.
4. **Assess/measure:** apply the oracle, evidence reader, and size metric.
5. **Compare/report:** select compatible results and render a fresh report.

On a full cache hit, report from recorded results without launching browsers,
starting fixture servers, or running D2Snap. Artifact integrity checks and
manifest planning are inexpensive and still run.

Capture protocol v1 must explicitly define how live input values, checked state,
selected options, and textarea content are serialized. Recommended policy:
mirror those browser-authoritative properties into a clone before serialization,
without adding inferred labels, roles, target markers, or removing clutter.
Hash this acquisition code and policy; apply it equally to every subject and
the raw baseline. Preserve the original observation as a diagnostic artifact.

Replay captured inputs in a fresh, inert Chromium document with the pinned
subject browser bundle; do not execute fixture scripts inside replay. POC
transform semantics are therefore declared **capture/replay**, not an implied
benchmark of every live-DOM behavior. Validate capture fidelity against live
state and detect required information missing before compression.

### 6.2 Hash scheme

Use SHA-256 over domain-separated, schema-versioned canonical manifests and
byte hashes. Recursively sort object keys; preserve meaningful array order;
reject non-finite numbers and unsupported values. Normalize only documented
path/config representations, never silently rewrite DOM or output text.

| Key | Required dependencies |
| --- | --- |
| Implementation key | Case ID, stack ID, variant ID, and presentation definitions/settings (`implementationKey`) |
| Fixture build key | Stack/page dependency closure, shared assets/data, copied components, lockfile, build flags/config, relevant toolchain versions and allowlisted environment |
| Capture key | Implementation hash, fixture artifact hash, page/state recipe, seed, capture/validation code, acquisition policy, browser revision, viewport, locale/timezone/clock and other rendering settings |
| Transform key | Exact input bytes hash, D2Snap executable artifact/runtime dependency hash, subject adapter, resolved config hash, execution/runtime fingerprint |
| Assessment key | Exact input/output hashes as required by metrics, page/state oracle, evidence reader/scorer hash, metric schema; tokenizer identity if enabled |
| Comparison key | Sorted selected result identities, comparison mode, explicitly allowed changing axes, report implementation/schema |

Capture identity includes the acquisition validation contract, not downstream
output expectations. If a ground-truth edit changes only output assessment,
reuse capture/transform. If it changes fixture validation or state preparation,
invalidate capture too.

The implementation must track actual dependencies, including imported shared
components, fonts/assets, lockfiles, and untracked relevant working-tree files.
Start conservatively at whole-app build granularity where fine-grained
dependency closure is unavailable. Extra invalidation is acceptable; stale
reuse is not. Do not hash the entire repository indiscriminately: a design-doc
or report-only edit should not rebuild fixture apps.

### 6.3 Configuration is a first-class identity

Hash the complete effective configuration, not just a label such as "balanced":

- `rE`, `rA`, `rT`.
- Every option/default, including attribute scores and fallback, filtering,
  Markdown/TextRank options, image-label lifting, and ID behavior.
- Adaptive budget/iteration policy when adaptive mode is introduced.
- Any new option affecting transformation, even if omitted by a caller.

For a fixed-config comparison, pass the same explicitly resolved options to
both subjects. If versions have incompatible option schemas, fail that
comparison instead of silently dropping options. A comparison of each version's
own defaults is a distinct, labeled experiment where both code and config may
change. Record requested and resolved config separately.

### 6.4 Invalidation examples

| Change | Reuse | Rerun |
| --- | --- | --- |
| D2Snap heuristic/source or bundled runtime dependency | Fixture build and capture | Affected transforms and assessments |
| Attribute scores or other config | Build and capture; unrelated configs | Changed-config transforms and assessments |
| Page markup/styles/seed or shared app shell | Unaffected app artifacts where dependencies prove independence | Affected build/capture and downstream work |
| Output oracle/evidence reader | Build, capture, transform | Assessments and comparison |
| Tokenizer/size metric | Build, capture, transform | Measurement/assessment only |
| Browser/capture protocol | Fixture build where unchanged | Capture and downstream work |
| Report presentation | All measurements | Report only |
| Branch renamed, identical executable content | All compatible results | Provenance/report only |

Store deterministic negative quality results as well as successes. A known
coverage failure should not rerun indefinitely. Do not memoize crashes,
timeouts, interrupted runs, or incomplete writes as valid results. Record
errors and retry them on the next requested run.

Artifacts are immutable with integrity hashes. Publish writes atomically;
coordinate concurrent producers by key. Missing/corrupt artifacts invalidate
the hit with a visible diagnostic. A force/refresh option must create a new
observation without erasing prior results.

## 7. Comparing versions, branches, and configs fairly

Git names are provenance, not content identity. Resolve a branch/tag to a commit
at run start and record it. Hash the actual built executable and dependency
closure; identical artifacts may reuse results across branches.

For a dirty working subject, include relevant tracked modifications and
untracked source in the build manifest. Do not use HEAD alone, a mutable branch
name, timestamps, or a generic "dirty" flag as the cache key.

Build immutable subjects into separate artifact directories from explicitly
selected source snapshots. A future ref resolver can materialize sources into
isolated scratch directories; it must never switch/reset the user's active
checkout or read/write the project's main checkout as a shortcut.

Use one pinned harness/corpus to compare subjects from other refs. Do not run
each branch's possibly different benchmark and call those results equivalent.
The subject adapter exposes only the necessary D2Snap API and records
compatibility failures.

| Comparison mode | May change | Must remain fixed |
| --- | --- | --- |
| Code regression | D2Snap artifact | Case/stack/variant implementation, input/state, acquisition/runtime protocol, explicit config, oracle, scorer and metric |
| Config experiment | Config | D2Snap artifact plus all non-config axes |
| Code/config grid | Explicitly selected artifact and config axes | Case/stack/variant implementation, corpus, acquisition/runtime protocol, oracle, scorer and metric |

A transform cache key changes when code or config changes. A comparison pairing
key deliberately excludes only the axis under test. Do not confuse these keys:
different cache identities can still be a valid experimental pair.

Capture and comparison pairing require `implementationHash`, even when two
presentations produce identical DOM bytes. Presentation changes cannot appear
as code/config regressions. Transform reuse remains safe for exact identical
input bytes with identical subject/config/runtime identities.

Pair on exact input identity, state, and all fixed axes. Reject or mark unmatched
cases explicitly; report matched/expected counts and reasons. Never silently
average different corpora, or reuse scores from different oracle versions.
An intentionally changed corpus is a new benchmark version, not a D2Snap
regression result.

Runtime timing is diagnostic in the POC. Cached historical latency is not a new
timing sample. Later timing experiments need machine/runtime fingerprints,
warmup, repetitions, concurrency controls, and fresh measurements even when
quality/size artifacts are reused.

## 8. Initial experiment set and acceptance

Use ten uniform reduction levels, consistent with `eval/eval_space`, not claims
of optimal settings or fidelity levels. Higher numbers request more reduction:

| Config | rE | rA | rT | Purpose |
| --- | --- | --- | --- | --- |
| `1.0` | 1.0 | 1.0 | 1.0 | Maximum requested reduction |
| `0.9` | 0.9 | 0.9 | 0.9 | Uniform reduction |
| `0.8` | 0.8 | 0.8 | 0.8 | Uniform reduction |
| `0.7` | 0.7 | 0.7 | 0.7 | Uniform reduction |
| `0.6` | 0.6 | 0.6 | 0.6 | Uniform reduction |
| `0.5` | 0.5 | 0.5 | 0.5 | Uniform reduction |
| `0.4` | 0.4 | 0.4 | 0.4 | Uniform reduction |
| `0.3` | 0.3 | 0.3 | 0.3 | Uniform reduction |
| `0.2` | 0.2 | 0.2 | 0.2 | Uniform reduction |
| `0.1` | 0.1 | 0.1 | 0.1 | Light requested reduction |

Materialize all other options explicitly from a documented baseline, using
`debug: false` and no test-only ID injection. Include a separate raw-capture
baseline, scored and measured with the same oracle. Native unit controls do
not add a fourth framework app.

Eighteen states by ten configs gives 180 D2Snap results per artifact, plus
18 reusable raw baselines. Two subject artifacts produce up to 360 transforms;
unchanged capture and identical transform content can be reused.

Acceptance for the harness:

1. All nine pages build and their two state recipes pass live validation.
2. Raw capture/control evidence passes the required-item contracts; any
   acquisition limitation is surfaced before compression.
3. Missing content, states, and associations demonstrably fail scorer tests.
4. Every result reports exact KB and item-level required-information retention,
   with content and control-information breakdowns.
5. An unchanged second run performs zero captures/transforms and reproduces
   stored measurements and verdicts in a fresh report.
6. Config, subject, oracle, fixture, and report changes invalidate only their
   documented downstream stages, with automated cache tests.
7. A baseline/candidate comparison rejects mismatched fixed variables and
   reports complete matched/expected case counts.
8. D2Snap failures remain visible benchmark findings; the harness does not
   alter gold data or fixtures to make a candidate look successful.

Full fidelity is the initial quality target, not a prerequisite for the
benchmark to be useful. Preserve failing diagnostic configurations and show
their tradeoffs rather than excluding them from the report.

## 9. Authoring skills and repository layout

Current layout, with future directories marked explicitly:

```text
bench\
  README.md
  DESIGN.md
  AUTHORING.md
  AGENTS.md
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  tsconfig.json
  cases\               One file per UX case, plus shared definition helpers
  src\
    contracts.ts       Typed/validated case, state, evidence and adapter schemas
    matrix.ts          Case/stack/variant registry and implementation plans
    print-matrix.ts    Matrix CLI
    evidence\          Output-only reader, scoring and exact-byte measurements
    cache\             Canonical stage identities, comparison pairing and store
    runner\            POC build, capture/replay, scoring, cache and HTML report
  tests\               Contracts, cases, evidence and cache tests
  browser-tests\       Live-property capture and inert/repeatable replay tests
  packages\
    scenarios\         Public seeded domain data and fixed environment
  stacks\              Five records fixture apps; other UX implementations planned
  configs\             Explicit POC D2Snap options and compression profiles
  skills\              Future: discoverable agent-authoring skill/templates
  playwright.config.ts Future: browser execution configuration
  .cache\              Ignored runtime artifacts
  reports\             Ignored generated reports
```

One harness project owns schemas, cases, scoring, cache, and the runner.
Cases remain separate files without a separate package. The browser-safe
scenarios package and each future stack app retain their own dependency
boundaries. `pnpm --dir bench check` exercises the foundation APIs and independent
oracle controls through a single typecheck and test entry point.
The cache store validates integrity, reuses deterministic results
(including failed quality verdicts), and coordinates producers. The runnable
slice supplies conservative whole-app/source dependency manifests and complete
effective configs. Source-ref materialization and fine-grained dependency-closure
discovery remain future orchestration work.

`pnpm --dir bench demo` builds production fixture assets and a browser D2Snap
bundle from the current worktree. Build/capture/transform/assessment stages are
independently cached. Captures mirror browser-authoritative form properties and
source CSS hiding into a body clone. Replay disables JavaScript and network,
removes fixture scripts/handlers, and explicitly evaluates only the bundled
subject. No runtime LLM or external inference service is involved.

Playwright 1.58.2 and its Chromium revisions are pinned; the earlier attempt to
download a newer revision timed out, so the POC uses this available stable
revision explicitly, never a silent system-browser fallback. Runtime identity
includes browser revision, OS/architecture, Node, and fixed render settings.
An unchanged `demo --assert-cached` must perform zero fresh stages or browser
launches. `demo --refresh` creates observations without replacing canonical
results. Outputs and scores, not wall-clock latency or report timestamps, are
the deterministic measurements.

Keep fixture dependencies and runner tooling in a bench-local package/workspace
boundary, isolated from the library's published dependencies. Reuse compatible
tools already used by the repository; do not refactor the root build/eval
systems merely to add this POC.

Proposed skill responsibilities:

| Skill | Inputs | Outputs and required checks |
| --- | --- | --- |
| `bench-add-stack` | Framework/library, pinned versions, existing page contracts | Scaffold app, adapter/manifest, implement existing patterns, validate runtime behavior and absence of oracle leakage |
| `bench-add-page` | UX pattern/task context, states, important content/control information | Framework-independent oracle, deterministic data, state recipes, implementations across selected stacks, positive/negative scorer fixtures |
| `bench-add-state` | Existing page and new interaction state | Explicit new denominator and state recipe; no retroactive expansion of old-state requirements |
| `bench-compare` | Subject refs/artifacts, configs, allowed changing axes | Validate comparison plan, reuse cache, produce paired report; never change gold data |

Skill names are proposed authoring interfaces, not installed slash commands.
Canonical instructions/tooling live under `bench`. The phase-one workspace is
bench-local pnpm, with one harness, shared scenario data, and one future app per stack
rather than one dependency installation per matrix cell. At implementation time,
verify how the chosen coding agent discovers skills; if it requires a
conventional discovery directory, add only a minimal discoverable wrapper that
points here. Do not assume an arbitrary `bench\skills` directory is auto-loaded.

An agent writes and validates code, not the truth after seeing a candidate's
failure. Review oracle changes separately from perception changes. Record
generation provenance (agent/model/instruction version) for auditability;
identical resulting source content does not need a new runtime cache entry
merely because a different agent generated it.

## 10. Relationship to the existing repository

Reuse concepts and tools, not undocumented assumptions:

- `src\D2Snap.ts`: container reduction, actionable tag/role preservation,
  attribute scoring, Markdown/TextRank, and image-label lifting are the current
  mechanisms under measurement.
- `src\var.ATTRIBUTE_SCORING.ts`: `role` is scored 0.32, `disabled` 0.34,
  `aria-*` 0.62, and `class` 0.77. Some configs can remove role/state before CSS
  classes. This is a testable hypothesis, not a proposed fix in this design.
- `src\AdaptiveD2Snap.ts`: later budget-based experiments can reuse adaptive
  mode, but the POC starts with explicit configs to simplify controlled changes.
- `eval\eval_success\subjects\D2Snap.py`: existing asymmetric parameter sweeps
  provide prior art. Leave the existing evaluator operational.
- `eval\eval_success\shared.py`: current target matching/reference sentinels
  are not the new output-only information-retention oracle.
- `src\D2Snap.ts`: existing size metadata uses character lengths and a length/4
  estimate, including pre-final-output measurements. Compute bench KB directly
  from final output bytes instead of reusing that estimate.

## 11. Implementation sequence

1. Define typed contracts, evidence rules, canonical manifests, and cache tests.
2. Scaffold the three selected apps; implement the three shared page contracts
   and two states each, with local synthetic data and independent ground truth.
3. Add Playwright capture/replay, immutable subject artifacts, four configs,
   output scoring, and exact-byte measurement.
4. Add cached case reporting and the paired comparison summary.
5. Add tested authoring skill/templates based on the working scaffold, and
   demonstrate a repeat run plus code/config/oracle invalidation.

Do not build a bespoke dashboard, add token libraries, or implement additional
stacks before the POC answers the preservation-versus-size question.

## 12. Sources

Research accessed on 2026-09-15. Survey editions and meanings are recorded above;
vendor documentation is rolling and does not establish installed-base share.

1. Stack Overflow 2025: [technology](https://survey.stackoverflow.co/2025/technology/#1-web-frameworks-and-technologies), [methodology](https://survey.stackoverflow.co/2025/methodology/).
2. State of JS 2025: [frameworks](https://2025.stateofjs.com/en-US/libraries/front-end-frameworks/), [methodology](https://2025.stateofjs.com/en-US/about/).
3. State of React 2025: [component libraries](https://2025.stateofreact.com/en-US/libraries/component-libraries/), [methodology](https://2025.stateofreact.com/en-US/about/).
4. Monterail: [State of Vue 2025](https://www.monterail.com/stateofvue).
5. MUI: [customization](https://mui.com/material-ui/customization/how-to-customize/), [grid virtualization](https://mui.com/x/react-data-grid/virtualization/).
6. Ant Design: [introduction](https://ant.design/docs/react/introduce/).
7. [shadcn introduction](https://ui.shadcn.com/docs), Radix [composition](https://www.radix-ui.com/primitives/docs/guides/composition) and [accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility).
8. Angular: [accessibility, Material and CDK guidance](https://angular.dev/best-practices/a11y).
9. PrimeNG: [table](https://primeng.dev/table), [pass-through](https://primeng.dev/passthrough).
10. [Element Plus](https://element-plus.org/en-US/).
11. Bits UI: [introduction](https://www.bits-ui.com/docs/introduction).
12. [IBM Carbon](https://carbondesignsystem.com/), [SAP UI5 Web Components](https://ui5.github.io/webcomponents/).
13. ServiceNow: [WorkArena](https://github.com/ServiceNow/WorkArena).
14. W3C: [ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/).
15. Playwright Test: [reporters](https://playwright.dev/docs/test-reporters), [projects and dependencies](https://playwright.dev/docs/test-projects).
16. Promptfoo: [caching](https://www.promptfoo.dev/docs/configuration/caching/), [JS/TS custom providers](https://www.promptfoo.dev/docs/providers/custom-api/).
17. OpenAI: [tiktoken](https://github.com/openai/tiktoken).
18. dqbd: [JS/WASM and pure-JS tiktoken ports](https://github.com/dqbd/tiktoken).
