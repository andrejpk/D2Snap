# Output evidence scorer (phase 1)

`assessOutput(output: string, state: CaseState, input: string, format?: OutputFormat): Assessment`
is the only scoring entry point, exported by `bench\src\evidence\index.ts`.
The contract is validated with the shared schema. **Input is used only for
`Buffer.byteLength(input, "utf8")`**, never to reconstruct evidence.

Results include `requirements` (`id`, `category`, `passed`, `verdict`, failure
`reasons`, individual diagnostic `checks`, `alternatives`, and
`matchedAlternatives`, `match`, `semanticPassed`, and `inferenceRules`), `retention.content`,
`retention.control`, `retention.overall` (each with `numerator`, `denominator`,
`fraction`), `semanticRetention` (the same categories using strict evidence only),
`fullFidelity`, `inputBytes`, `outputBytes`, `outputKB` (decimal
1000), `sizeRatio`, and reader status/version. An empty category has
`fraction: null`. Zero input has `sizeRatio: null` and
`sizeRatioStatus: "zero-input"`, including when output is also empty.

For a state requiring only page text `Acme`, output `"Acme"` and input `"12345678"`
produce overall/content retention `1/1`, control retention `0/0` with a null
fraction, full fidelity, 4 output bytes, 0.004 KB, and a 0.5 size ratio.
Empty output for that state produces `0/1` and no full fidelity, even if the
input contains `Acme`.

Requirements express goals rather than prescribed widgets. `evidence` is an
OR of named alternatives; `allOf` is an AND of checks within one alternative.
A goal passes once if any complete alternative passes. Partial evidence from
different alternatives cannot be combined, and matching multiple alternatives
does not inflate retention. Every variant uses the same goals and denominator.
Alternative diagnostics record both passing and failing representations.

`inspectEvidence(output, state, assessment)` additionally locates display-only
nodes for an existing assessment. It uses the reader's scopes, roles, names, and
stored passing alternatives. Unsuccessful goals may have context/candidate
locations, but these are explicitly not matches. Its temporary
`data-bench-view-node` attributes exist only in report previews: they are never
injected into fixture captures, D2Snap input/output, or byte measurements.

## Versioned reader: `html-markdown-v5`

The primary score measures explicit or bounded inferred task evidence. Each goal
records `match: explicit | inferred | none`; successful inferred checks identify
their rules. `semanticRetention` separately evaluates the same contract using
ordinary HTML/CommonMark parsing, exact values, and accessible names only.
This is a deterministic usability proxy, not proof that an arbitrary agent will
complete the task. No model is called, and inferred markup never changes output
bytes or the saved source.

The producer declares `format: "html"` for raw HTML, including the corpus's
hand-authored controls and a future raw-DOM baseline. `format: "html-markdown"`
(the default) interprets mixed Markdown/HTML. Record `reader.format` alongside
the version in assessment identity. Never try both formats and pick the higher
score.

This distinction matters: four-space indentation is an ordinary HTML formatting
choice but a code block in Markdown. Blank lines can also end CommonMark HTML
blocks. Explicit provenance prevents whitespace or removal of unrelated chrome
from changing how a known HTML representation is read, without promoting
literal Markdown code samples to actionable controls. Both formats measure the
unaltered output bytes.

- In `html` mode, jsdom parses the output directly.
- In `html-markdown` mode, pinned Marked 15 parses CommonMark plus GFM tables. Headings (ATX and setext),
  paragraphs, inline emphasis, entities, links, and embedded HTML controls are
  supported. Fenced/inline code is literal content, never a semantic control.
  Additionally, the `hybrid-table` rule recognizes headered pipe tables in raw
  HTML, including flattened newlines. A unique separator, nonempty unique
  headers, consistent row widths and complete row boundaries are required.
  Escaped pipes and inline HTML are preserved through tokenization; code samples
  cannot become controls. Malformed/ambiguous runs are not reconstructed.
  This is table-specific, not arbitrary recursive Markdown or a substring fallback.
- jsdom parses inert HTML with **no scripts or external resources enabled**.
  Script, style, comment, template, noscript, embedded document, SVG, and canvas
  contents are excluded. Styles are consulted first for detectable hiding.
  Event handlers are never run.
- Accessible names, descriptions, and native/ARIA roles come from the pinned
  `dom-accessibility-api`, rather than invented label heuristics. Whitespace is
  normalized, case and substantive punctuation are not. Output-local IDREFs
  and native label relationships must resolve uniquely; IDs never select
  oracle targets.
- Page scope is the output body. Row scope requires one semantic row with an
  entire cell matching the anchor. Region/dialog/toolbar scopes require one matching
  semantic accessible name. Headings also introduce named sibling sections
  ending at the next same-or-higher heading, with nested subsections included.
  Existing named regions/dialogs retain their original boundaries; heading
  sections are not synthesized inside them.
- Selection-toolbar scope requires the target to be the sole explicitly selected
  row in a uniquely identified table/grid, with one toolbar whose `aria-controls`
  references that table/grid. Controlled-popup scope follows an expanded trigger
  in the target row through a unique output-local `aria-controls` reference to
  visible content. Missing or ambiguous associations fail; a matching action
  label somewhere else is not sufficient.
  In v5, `selected-record-context` can alternatively establish the action group:
  one uniquely identified row must be the sole selected row, corroborated by
  `aria-selected` or a checked row-selection checkbox explicitly naming the
  record. An immediately preceding `1 request/record/item selected` cue must
  name that same record. Only the adjacent control-only group or consecutive
  action siblings are eligible, even if toolbar markup has been removed.
  Conflicting selections, multiple matching groups, disabled actions, and
  explicit references to other existing targets fail. A dangling table reference
  contributes no evidence; the independent selection and local cue must suffice.
  Strict semantic retention still requires the original explicit association.
- Text is a unique bounded phrase in visible text runs, retaining inline
  formatting equivalence but not concatenating independent blocks. `120`
  cannot match `1200` or `120.00`; `PR-120` cannot match `PR-120-2`.
  Text and values in unrelated attributes, hidden nodes, or other scopes do
  not count. Duplicate eligible matches fail.
- Records require a semantic table/grid owner, one column header per requested
  label, and exactly one associated cell in the anchored row, with exact
  normalized cell value. Native HTML, ARIA grids, and parsed GFM tables work.
  Fields explicitly typed `valueType: person-name` can additionally use
  `person-name-initials`: two to four capital initials followed by a multiword
  name must agree with that name's initials and the complete expected name.
  This also applies to property values. It is an explicit display-normalization
  policy, not a generic substring rule: literal names with the same prefix are
  inherently indistinguishable and must not use this type if that interpretation
  is inappropriate.
  Output-local `headers` IDREFs support reordered columns. Simple positional
  columns require equal row widths; sparse ARIA columns require explicit
  positive `aria-colindex` on the relevant header and cell. Implicit merged
  cells, row spans, mixed indexed/unindexed positions, duplicate headers, and
  headerless bags of values do not establish a relationship.
- Properties accept exact `Label: value` text runs or simple definition-list
  term/value pairs within the resolved scope. Missing, repeated, contradictory,
  or unrelated facts fail. This is not arbitrary key/value layout inference.
- Controls need a native or explicit ARIA semantic role, not merely visible
  text. Matching role/name candidates must be unique within the resolved scope.
  The `adjacent-control-label` rule may name an otherwise unnamed native input,
  select or textarea from immediate preceding text or a simple passive label/span.
  The parent must contain exactly one visible control of that role. Labels are
  bounded to 80 characters; conflicting names, explicit broken name references,
  hidden labels and labels targeting another control cannot be overridden.
  Hidden, aria-hidden, inert, hidden-input, closed-details content, and detectable
  CSS display/visibility hiding cannot provide interactive evidence.
- Native applicable disabled/required/checked states have meaningful defaults;
  boolean HTML attributes use presence, not the string `"false"`. Disabled
  fieldsets include the first-legend exemption. Native selected options use
  their parsed selected property. Supported semantic controls without
  `aria-disabled` default to enabled, including links and ARIA buttons, unless
  native or ancestor evidence establishes disabled state. This reads output
  semantics, not whether a real click handler works.
  Other requested ARIA states must be explicit;
  missing expanded/selected on custom controls fails even when expecting false.
  Mixed/invalid boolean strings and contradictory native/ARIA states fail.
  `aria-required=true` or `aria-disabled=true` may add semantics to an otherwise
  unconstrained/enabled native control; they cannot negate native true states.
  Invalid state is explicit ARIA evidence, not inferred from browser validation.
- Input/textarea values use parsed properties. Select uses one selected option's
  visible text, not its opaque `value`. Custom comboboxes use an input value or
  one coherent displayed text run; conflicting `aria-valuetext` fails.
  Validation descriptions use accessible-description computation, including
  legitimately hidden IDREF targets; adjacent error text alone is insufficient.
- A combobox rule may declare `choices`. Each required visible name must resolve
  to exactly one enabled option in the native select, or one contained/uniquely
  controlled visible ARIA listbox. Broken references, duplicates and disabled
  options fail. Other UI paradigms can express the same choices as separate
  control checks in one evidence alternative.

## Deliberate limits

No browser layout, scripts, shadow DOM, frames, canvas, natural-language
inference, CSS-generated content, or action execution. External stylesheets
are not fetched. jsdom can detect inline/local stylesheet hiding, not viewport
occlusion. HTML parser recovery is deterministic, not an HTML conformance test.
Raw D2Snap custom serialization beyond the grammar above needs a new documented
reader version and tests, not a success-shaped fallback. Multi-select values,
complex multi-level table headers and implicit spanning-table inference are not
supported. Scopes and rules must be representable in the contracts.

The reader caps output at 1,000,000 UTF-8 bytes, 20,000 elements, and 128 levels
of nesting. Exceeding limits or a parsing failure yields reader status
`unsupported` and failed requirements with diagnostics while still reporting
exact byte metrics. Invalid contracts or format names throw, rather than becoming scored runs.

Run `pnpm --dir bench test` from the repository root after installing the
bench workspace dependencies. Evidence tests live in `bench\tests\evidence`.
Pinned `marked` provides a real GFM/mixed-format parser;
the small accessibility library supplies standards-based name/role/description
computation. These are evidence-reader dependencies, not a browser runner.
