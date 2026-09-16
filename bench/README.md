# Perception Bench

Retain required page content and control information while minimizing D2Snap
output size. **Phase 1 defines the experiment, not the nine UI implementations.**
No live capture, D2Snap experiment runner, or Playwright report is implemented yet.

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
Phase 1 does not need installed browsers, an LLM API key, or a build step.

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
`pnpm matrix` shows nine **planned implementations** and eighteen state cases.
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
lost target associations still fail. This is not arbitrary visual inference.

## One harness, separate fixture data

The workspace has two projects today: the **harness at `bench`** and the small
**scenarios package**. Contracts, cases, evidence, and cache are ordinary harness
modules, not separate packages. The future runner belongs in the same project.

| Location | Responsibility | Browser apps may import? |
| --- | --- | --- |
| `packages\scenarios` | `@perception-bench/scenarios`: shared synthetic data and fixed environment | Yes |
| `cases` | One file per UX case, with independent goals and evidence | **No** |
| `src\contracts.ts` | Validated case/state, evidence-rule and adapter types | Types only |
| `src\matrix.ts` | Stack/variant registry and implementation plans | **No** |
| `src\evidence` | Output-only scoring and exact UTF-8 size | **No** |
| `src\cache` | Canonical identities and immutable result reuse | **No** |
| `tests` | Independent controls and harness tests, grouped by responsibility | **No** |

Future apps live under `stacks\<stack-id>`, one project per framework/library
combination, not per case or variant. Each app declares its own UI dependencies
and imports `@perception-bench/scenarios` with `workspace:*`. All projects are
private. Do not enable global hoisting or add every UI library to the harness.

An authoring agent reads the chosen case, stack/variant plan, shared data, and
[authoring guidance](AUTHORING.md), then builds the UI and a state adapter.
The adapter turns `preparation` and `readyWhen` prose into framework-specific
Playwright setup/readiness checks; the scorer already reads `requirements`
directly as data. The agent may read the oracle, but the browser app must not
bundle it. Authoring skills and executable adapters remain future work.

## Scope of the measurements

Required goals have `content` or `control` categories. A goal passes only when
one complete expression retains its facts, state and relationships. Wrong-row
values, ambiguous controls, missing error associations and lost control semantics
must not pass because the same text exists elsewhere.

Size is measured on the exact returned output with UTF-8 bytes and decimal KB.
Smaller is better **at equal retention**; empty output is not an improvement.
There is no universal model-token count, so tokens are not a phase-one metric.

The scorer's positive representations are deliberately small native HTML and
Markdown controls, not generated application fixtures or measured D2Snap results.
They test the oracle independently of a UI library. Live application capture,
artifact building from refs, dependency-closure discovery, and HTML reporting
remain later phases.

The [evidence reader](src/evidence/README.md) documents its supported
grammar and limits. Its declared HTML versus mixed Markdown/HTML format is
assessment metadata, not an option to tune for a better score.

The cache module implements canonical stage keys, comparison pairing, and a
local integrity-checked store. Callers still supply complete dependency/config
manifests, including a case/stack/variant implementation hash for capture and
comparison. Presentation changes cannot masquerade as code/config-only
comparisons, even if output bytes happen to match. Storage assumes a trusted
local filesystem with hard-link support;
abandoned producer locks time out explicitly rather than being deleted unsafely.

See [AUTHORING.md](AUTHORING.md) for the row/column expansion workflow and
[DESIGN.md](DESIGN.md) for the research, cache protocol, and larger POC plan.
