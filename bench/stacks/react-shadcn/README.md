# React + shadcn/Radix records fixture

A bounded browser-only procurement workspace for `records / icon-toolbar`.
Only `browsing` and `target-actions-available` are implemented. Other explicit
case/variant URLs display an error; unsupported adapter states throw.

## Run (after the parent installs the bench workspace)

From the repository root, with Node 24 and pnpm 10.6.0:

```powershell
pnpm --dir bench/stacks/react-shadcn typecheck
pnpm --dir bench/stacks/react-shadcn build
```

The build script is exactly `vite build --base=/fixture/`; typecheck is
`tsc --noEmit`. Vite emits conventional production assets to this package's
`dist/`, which the parent hosts at `/fixture/` on the runner origin. No separate
fixture dev server is needed or started.

Open `/fixture/?clawpilotTheme=light` on that origin. Omitting case and variant
defaults to `records / icon-toolbar`; the explicit equivalent is
`/fixture/?case=records&variant=icon-toolbar&clawpilotTheme=light`.
Asset entrypoints are relative and Vite rewrites built asset URLs for the base.
Navigation anchors stay on the current fixture URL; unsupported-view recovery
changes only the query, preserving the fixture path and theme parameter.
The parent owns installation, server lifecycle and reporting. Runtime is purely
deterministic local UI: no LLM, remote fonts, APIs, assets, storage, clock reads,
or runtime harness imports.

The Clawpilot theme is detected before application JavaScript; use
`&clawpilotTheme=light` or `&clawpilotTheme=dark` to override the system setting.
Fonts use local Segoe UI / Aptos / Calibri with platform fallbacks. Fix the
browser color scheme or theme parameter when making comparable captures.

## UI behavior

All shared seeded requests, statuses, supplier directory, cost centers and
workspace chrome appear. Search matches ID, supplier, owner, status or amount;
the status filter intersects it. Changing a filter clears selection. Reset
clears filters and selection, not locally edited owners; a reload restores seeds.
Each row's checkbox (or row click) toggles the same single-selection behavior.
No request gets special markup or action treatment.

Selecting a row marks it `aria-selected="true"` and reveals a real Radix Toolbar
with icon buttons named **View request**, **Reassign owner**, and **Clear selection**.
Its `aria-controls` references `requests-table`. Radix provides toolbar roving
focus and keyboard handling. View opens a Radix modal with the selected row's
facts. Reassign opens a Radix modal with an owner form; Save updates that row and
announces the result. Radix supplies portal, focus trap, Escape and outside-click
dismissal. The opening button regains focus on close.

Overview and Reports navigate to actual page sections. Help, the guide,
notifications and footer controls open local informational dialogs. There are
no pretend backend actions. Client errors/rejections and React render failures
are shown in a visible alert, rather than silently ignored.

## Adapter contract

`adapters/records.ts` exports **`recordsAdapter`** and the same object as default,
implementing `CellAdapter<Page>` from the harness via a type-only import.
The runner supplies a Playwright `Page` already navigated to
`/fixture/?clawpilotTheme=light`; `prepare` reloads that same URL,
checks the reset state, optionally selects `RQ-1042`, then checks readiness.
`assertReady` checks exact seeded row count/order/facts/headers, query and status
defaults, every row's selection control, absence of dialogs/client errors, and
the selected target's enabled actions plus the unambiguous toolbar/table link.
It does not import the oracle, score captures, launch a browser, or set the
runner's environment. Target selection exists only in this harness-side adapter.

Parent registration (not added here):

```json
{
  "caseId": "records",
  "stackId": "react-shadcn",
  "variantId": "icon-toolbar",
  "stateIds": ["browsing", "target-actions-available"],
  "adapterModule": "./adapters/records.ts"
}
```

`playwright@1.58.2` and `esbuild@0.28.2` are supplied by the parent harness.
Only Playwright's `Page` type is imported here; neither package is added as an
app runtime dependency. Package
typechecking includes the adapter and uses this app's standalone JSX/DOM config.

## Exact direct package requirements

Runtime: `@perception-bench/scenarios@workspace:*`, `react@19.1.0`,
`react-dom@19.1.0`, `@radix-ui/react-toolbar@1.1.10`,
`@radix-ui/react-dialog@1.1.14`, `lucide-react@0.511.0`.

Development: `vite@7.3.1`, `typescript@5.8.3`, `@types/react@19.1.6`,
`@types/react-dom@19.1.6`, `@types/node@24.13.3`.

Direct external versions are exact. The parent owns the bench lockfile and
transitive resolution. There is no shadcn runtime package: it is source-owned UI.

## Provenance and boundaries

`src/components/ui/table.tsx` is adapted from the **official shadcn/ui**
`registry/new-york-v4/ui/table.tsx` source, retrieved using HTTP tooling from
<https://ui.shadcn.com/r/styles/new-york-v4/table.json> on 2026-09-16.
Its MIT license, fetched from
<https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md>, is retained
in `public/LICENSE.shadcn.md`, which Vite also copies into `dist/`.
Keep that notice with redistributed source/assets.

Changes: replace Tailwind utility classes with local Clawpilot CSS classes;
replace the `cn` dependency with a small class-string join; use a type-only React
import; omit unused footer/export and the unnecessary client directive. Preserve
the native table composition, scrolling container, prop forwarding and upstream
`data-slot` structure. This is a styled adaptation, not an unmodified generated
shadcn application. All other application components are custom composition of
React, Radix and Lucide, **not claimed as official shadcn components**. No Tailwind
dependency is needed for this deliberately small fixture.

The web-artifacts-builder skill's Clawpilot tokens, theme detection and local
font stack are used. Its dependency-installing initializer and single-file Parcel
bundling flow are intentionally not used for this workspace fixture.

No dependencies were installed into the workspace, and no lockfile, registry,
case, runner, or outside documentation was changed by this fixture implementation.
After the parent's workspace installation, app and adapter typechecking and the
`/fixture/` production build passed. Vite reports non-fatal warnings that Radix's
React Server Component `use client` directives are ignored in this client-only
bundle. Browser validation, screenshots and runner integration remain for the parent.
This is a local in-memory POC, not the remaining case/variant matrix or a backend.
