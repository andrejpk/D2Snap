# Svelte + Bits UI: request cards

Identity: `records / svelte-bits / record-cards`.

A light procurement inbox built with genuine Svelte 5 components, Bits UI
DropdownMenu/Dialog primitives, and compiled Tailwind CSS 3 utilities. It is a
card/list presentation, not a table adaptation. The only browser data import is
`@perception-bench/scenarios`; no cases, scorer, contracts, registry, or oracle
code is imported by the client.

## Dependencies and build

Dependencies were installed by the coordinator in the **bench-local workspace**. Do not install inside this package or create another
lockfile. All external versions are exact; the shared data dependency is
`workspace:*`. Runtime dependencies:

- Svelte `5.38.0`
- Bits UI `2.9.2`
- `@internationalized/date` `3.8.2` (Bits UI peer)
- `@perception-bench/scenarios` `workspace:*`

Build tools are pinned in `package.json`: Vite `6.3.5`, Svelte Vite plugin `5.1.1`,
Tailwind CSS `3.4.17`, PostCSS `8.5.6`, Autoprefixer `10.4.21`,
`svelte-check` `4.3.1`, TypeScript `5.9.2`, and Node types `24.13.3`.
Use Node 24+ and the bench pnpm version. No package install or browser install is
part of authoring this fixture. Browser validation uses the harness's existing
Playwright **1.58.2** and its bundled Chromium, never a system-browser fallback.
All dependencies are free/community packages; there are no paid components.

From the repository root:

```powershell
pnpm --dir bench\stacks\svelte-bits typecheck
pnpm --dir bench\stacks\svelte-bits build
pnpm --dir bench\stacks\svelte-bits preview --port 4173
```

The static production entry is `dist\index.html`, with assets based at
`/fixture/`. Open `http://127.0.0.1:4173/fixture/`. `dev` is also available.
There is no API server, external font, network data, randomness, persistent
storage, or runtime LLM. Reload recreates the shared seeded records.

## Interaction and semantics

- Each record is an ordinary named region, e.g. **Request RQ-1042**, headed by
  its request ID. Four definition lists associate Supplier, Amount, Status, Owner
  with the unchanged shared facts. Each term and value is a direct child of its
  definition list, using the existing reader's supported unambiguous structure. The same component renders dialog facts.
- Native enabled search filters ID, supplier, amount, status and owner,
  case-insensitively. The native Status select renders all four shared choices
  immediately; it defaults to All statuses. Search and status combine.
- Clear filters preserves edits. Reset workspace restores filters **and** seeded
  owners, remounting cards to discard menus and dialogs. Reload resets all state.
- Every card has its own Bits UI dropdown. Content is rendered **without a
  DropdownMenu.Portal** using the library's normal inline composition, so real
  `menuitem` controls stay inside the named card region. The dropdown is
  nonmodal (Bits Content defaults to `trapFocus={false}`), leaving the request
  facts and filters accessible while it is open. This Bits version has no
  `modal` prop on DropdownMenu.Root.
  No fake region, copied ARIA, special target marker, or scorer exemption is used.
- View request opens a Bits UI dialog with the selected record's current facts.
  Reassign owner opens a separate Bits UI dialog and a native owner select, whose
  choices are derived from the shared seeded owners. Save updates only that
  record in memory. Cancel, Escape and dismissal discard the draft; reopening
  initializes the draft from the current saved owner.
- Bits UI supplies menu keyboard handling, state attributes, dialog focus
  management, overlays, and dialog portals. Native inputs retain normal browser
  control/value semantics. Every request uses the same components and actions.

## Adapter and validation

`adapters/records.ts` default-exports `CellAdapter<Page>` with both states:

- `browsing`: reload, empty search, All statuses, seeded records, closed menus.
- `target-actions-available`: prepare browsing, open RQ-1042's menu, leave detail
  and owner dialogs closed.

The runner owns initial navigation, fixed browser environment and capture.
Readiness checks validate all seeded facts and definition-list labels, named
card uniqueness, enabled controls/options, empty/default values, and correctly
associated enabled target menu actions—not merely the app root. Contract types
are imported type-only in the adapter; the adapter is outside the browser entry.

After building, run the persistent app-scoped checks from the repository root:

```powershell
node --experimental-strip-types bench\stacks\svelte-bits\smoke.mjs
node --experimental-strip-types bench\stacks\svelte-bits\validate.mjs
```

Both checks load `dist` into a base64 asset map and use the harness's ephemeral
loopback server; no manually running preview or fixed port is needed. The smoke
check also accepts an optional loopback `FIXTURE_URL`. It tests both adapter
states, combined search/status filtering, empty results, clear filters, view,
owner save/cancel/Escape, another record's actions, reset/reload, and keyboard
menu opening/dismissal, with no uncaught client errors.

`validate.mjs` uses the actual `BrowserSession`, the unchanged records contract,
and `assessOutput(html, state, html, "html")`. Harness imports remain in these
Node-only tests, never the browser app. It creates **two fresh captures per
state**, requires explicit semantic raw goals of **3/3 browsing** and **5/5
target-actions-available**, and compares HTML/raw output, PNG screenshots and
assessment objects for exact equality. It saves the captures, screenshots and
assessments in the app-local ignored `validation-artifacts` directory. No shared
cache, report, registration, scenario, scorer or lockfile is modified.

Validated after the central install:

- Svelte typecheck: **0 errors, 0 warnings**.
- Vite production build: **passed**, output at `dist\index.html`.
- Live smoke interactions: **passed**.
- Raw browsing: **3/3**, both fresh runs, all explicit semantic matches.
- Raw target actions: **5/5**, both fresh runs, all explicit semantic matches.
- Per-state raw HTML/output, screenshots and assessments: **byte-identical /
  deeply equal** across the two fresh contexts.

Two authentic issues were corrected during validation: an unsupported Bits Root
`modal` prop, and wrapped definition-list terms the current reader did not
recognize (initial browsing result **2/3**, missing request-facts). Fact markup
was changed uniformly across every card and details dialog to direct term/value
lists; no oracle, evidence-reader, goal, or target-only markup was changed.
No additional installs, native build-script approvals or browser downloads
were needed. These checks validate Raw; they do not claim D2Snap transform scores.

## Visual/source provenance

The Clawpilot light/dark variables and first theme-detection script come from
`web-artifacts-builder`; typography starts with Segoe UI. Colors reference those
variables, including Tailwind's semantic aliases. Layout uses 4px spacing,
10px controls and 16px cards. No remote fonts or custom palette are used.
Components are original fixture code using the public Bits UI composition API;
no shadcn application or proprietary component source was copied.
