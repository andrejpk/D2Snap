# Adding consistent matrix cases and stacks

## The invariant

**A case's goals and acceptable evidence are shared across all stacks,
presentation variants, and D2Snap subjects.** Implementation-specific markup
and setup mechanics are allowed; implementation-specific success criteria are
not.

Think of the UX cases as the X axis and stack implementations as the Y axis.
Each case has goal-oriented states and each case/stack can have multiple
presentation variants. Configurations and subject artifacts are experiment
axes, not copies of the case or additional fixture apps.

## What every UX case standardizes

| Field | Contract |
| --- | --- |
| `id`, `revision`, `schemaVersion` | Stable identity plus explicit version; actual content must also be hashed |
| `task` | Why this information matters; not an instruction to execute an agent task |
| `datasetId`, `datasetRevision` | Same synthetic records and environment across implementations |
| `excludedFromSuccess` | Clutter that can be present but must not inflate the positive denominator |
| `states[].id`, `revision` | Stable observation state; unopened content is not required |
| `preparation` | Framework-independent setup intent, implemented by a cell adapter later |
| `readyWhen` | Observable completion conditions, not sleep durations |
| `requirements[].id`, `category`, `goal` | Stable logical purpose, independent of a widget's appearance |
| `requirements[].evidence` | Named alternatives; every `allOf` check in one alternative must pass |

Requirements deliberately do not contain CSS selectors, vendor class names,
test-only target attributes, or D2Snap options. Strict runtime schemas reject
unknown properties, duplicate identities, empty states/alternatives/denominators
and invalid category/evidence combinations. A control goal cannot use a text-only
alternative. Contract schema version 2 deliberately rejects the old single-rule
shape.

Describe "target actions available", not "row menu open", and "approval review",
not "modal dialog open". Preparation describes the end state; adapters may
select a row, reveal an overflow menu, or do nothing when actions are always
visible. Irrelevant mechanism controls are clutter, not mandatory goals.

Current evidence rules:

- `text`: scoped information, with formatting/whitespace equivalence.
- `record`: an anchored row with explicit column-label/value relationships.
- `properties`: associated label/value facts in text runs or definition lists.
- `control`: a scoped role/name, optional current value, required states and
  accessible description.

Scopes include page, an anchored row, and named regions, dialogs, or toolbars.
`selection-toolbar` requires the target to be the sole explicitly selected row
and a toolbar linked to its table/grid. `controlled-popup` follows the target
row's expanded trigger to its popup through output-local `aria-controls`.
Neither relation uses oracle IDs embedded into the page. Use the
narrowest task-appropriate scope. Do not declare every check page-wide to make
ambiguous output pass. Do not weaken a rule simply because one compressed
representation currently fails it.

Equivalent names, roles, and context relationships belong in the shared
goal's alternatives. Review equivalence deliberately; do not accept "any button"
or waive the target association for an icon-heavy variant. Keep the expected
subject, value, and required state unchanged across alternatives. A new visual
paradigm may need a new evidence-reader rule if the existing ones cannot express
its retained relationships; do not invent labels or inject target hints.

Declare the representation format when scoring: `"html"` for known HTML
controls/raw capture, `"html-markdown"` for mixed output. The evidence reader
records the selected format for assessment identity. Never auto-select a format
based on which produces a better score; indentation and blank lines have
different meanings in HTML and Markdown.

## Add a case

1. Define the task and important information before building UI or inspecting a
   candidate D2Snap result. Decide what is intentionally excluded.
2. Add public synthetic data to `packages\scenarios` if needed. Data can contain
   natural request IDs but no correct-target flags, oracle IDs, or expected
   scores. Bump its revision when semantics change.
3. Add a file under `cases` exporting its `defineCase(...)`
   definition, then register it in `src\matrix.ts`. Give each
   distinct observation its own state, setup intent, and ready checks.
4. Add independent hand-authored controls under `tests\cases`: different
   paradigms satisfying each state and at least one damaged representation
   that fails a specific required item. Never generate the expected output by
   traversing the requirements; that makes a tautological test.
5. Include alternate-format and ambiguity controls in `tests\evidence`
   when introducing a new representation pattern.
6. Add implementation plans covering the new case for every stack, with chosen
   presentation variants. The registry's initial-plan builder can do this for
   the POC. Run `pnpm --dir bench check`: the validator rejects missing
   case/stack coverage. Every registration must cover every state.
7. In the fixture phase, implement the case in each selected stack and declare
   its adapter. Unimplemented cells remain visibly planned.

Use repeated supplier names/amounts and repeated action labels to ensure the
scorer checks associations, not accidental text uniqueness. Positive controls
may contain clutter; deleting only clutter should preserve the score and reduce
bytes.

## Add a stack

1. Add the stack ID and library names to `src\matrix.ts`, then choose
   presentation variants for its implementation plans.
2. In the fixture phase, scaffold a private package under `stacks\<stack-id>`
   using supported framework tooling. Pin its versions and commit changes to
   the single bench lockfile.
3. Import `@perception-bench/scenarios` using a `workspace:*` dependency.
   Keep adapter type imports from `src\contracts.ts` type-only. Do not import
   cases, the registry, scorer or cache into client-side source.
4. Implement all existing case/state contracts with normal component usage.
   Keep goals and data consistent. Labels may use reviewed alternatives;
   controls, grouping, layout, slots and native/library semantics may differ.
5. Declare a `CellRegistration` for each implemented case/stack/variant.
   The matrix validator rejects unknown axes, duplicate implementations, adapter path escapes and incomplete
   state lists. A future runner must additionally verify that modules exist
   and their runtime checks pass.
6. Verify the raw captured input satisfies the oracle before interpreting a
   D2Snap failure. Distinguish acquisition loss from compression loss.

Do not duplicate a package per cell or variant: **one stack app renders multiple
cases and variants**.
This allows a new case to reuse the framework and library dependency graph.
Use `workspace:*` for local packages; keep incompatible external versions
isolated rather than forcing all stacks onto one version.

The harness is the `bench` project itself. Schemas, case files, scoring, cache,
and the future runner need no additional package manifests or builds. Keep
their module/test boundaries and content-addressed stages intact; package
consolidation does not change the measurement or invalidation protocol.

## Add a presentation variant

Add its identity/description to the `variants` catalog and an implementation
plan for each selected case/stack. An additional plan can reuse an existing
case/stack with a new `variantId`. Its adapter exposes that identity alongside
`caseId` and `stackId`; it cannot alter the oracle or omit difficult states.

The initial mixed-paradigm POC is deliberately small, not a full Cartesian
product of all variants. For an experiment attributing differences specifically
to a framework or to a presentation paradigm, add matched implementations that
hold the other factor constant. Do not attribute a mixed stack/paradigm result
to the framework alone.

## Change control

A behavior/ground-truth edit is a corpus revision, not a free improvement to
a D2Snap score. Review it separately from perception/config changes and retain
negative controls. Hash content even when a contributor forgets a revision bump.

State preparation and readiness belong to capture identity; output expectations
belong to assessment identity. Editing the scorer/oracle must not require a new
D2Snap transform if the captured input has not changed.

Compare code with fixed config, or config with fixed code. A joint code/config
experiment must declare both changing axes. Keep input, oracle, evidence-reader
version and metric protocol fixed; branch names alone are never identities.
Capture and pairing require `implementationHash`, derived from case/stack/
variant identity and relevant presentation definitions. Code/config comparisons
hold this fixed. Changing the UI paradigm is a corpus/implementation experiment,
not a D2Snap regression. Identical input bytes may still reuse a transform.

## Phase boundaries

Phase 1 provides contracts, shared data, scorer controls, matrix validation and
cache primitives. It does not provide a generator, a discoverable agent skill,
a Playwright capture adapter, or a full cached benchmark command.

The planned authoring skills will automate this workflow once the first real
stack implementations establish a working template. Do not scaffold nine
different conventions and attempt to reconcile them afterward.
