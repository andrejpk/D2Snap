# Angular Material + AG Grid Community operations workbench

Private benchmark fixture: **records / angular-material-ag-grid / selection-toolbar**.
This is a real standalone Angular application with Angular Material/CDK components
and AG Grid Community. It is not a React markup adaptation. No enterprise package,
license key, enterprise module, server-side row model, premium menu or external
service is used.

## Manifest handoff

The coordinator completed the single shared bench pnpm installation.
No dependency installation, workspace/lockfile edit, registry change, commit or
browser installation was performed while authoring this directory.

Pinned runtime dependencies:

| Package(s) | Version |
| --- | --- |
| `@angular/animations`, `common`, `compiler`, `core`, `forms`, `platform-browser` | `20.2.0` each |
| `@angular/material`, `@angular/cdk` | `20.2.0` each |
| `ag-grid-angular`, `ag-grid-community` | `34.1.0` each |
| `rxjs` | `7.8.2` |
| `tslib` | `2.8.1` |
| `zone.js` | `0.15.1` |
| `@perception-bench/scenarios` | `workspace:*` |

Pinned development dependencies:

| Package(s) | Version |
| --- | --- |
| `@angular/build`, `@angular/cli`, `@angular/compiler-cli` | `20.2.0` each |
| `typescript` | `5.9.2` |
| `@types/node` | `24.13.3` |
| `playwright` | `1.58.2` |

Angular 20.2 uses TypeScript >=5.8 and <6, so this package deliberately pins its
own TypeScript rather than using the harness's TypeScript 6. Node 24+ matches the
bench environment. Angular core/tooling and Material/CDK versions are aligned;
both AG Grid packages use the same Community release.

## Build and validation (after shared installation)

From the repository root:

```powershell
pnpm --dir bench/stacks/angular-material-ag-grid typecheck
pnpm --dir bench/stacks/angular-material-ag-grid build
pnpm --dir bench/stacks/angular-material-ag-grid test:smoke
```

- `typecheck` runs Angular's AOT compiler with strict template checks and no emit,
  then checks the adapter and smoke test separately.
- `build` uses Angular's application builder, disables font optimization/network
  fetching, and emits **`bench/stacks/angular-material-ag-grid/dist/index.html`**.
  The output-path object's `browser: ""` deliberately avoids `dist/browser`.
- Base URL is **`/fixture/`**. Serve the contents of `dist` at that prefix.
- `test:smoke` serves only this package's existing `dist` on an ephemeral loopback
  port and launches pinned Playwright 1.58.2's bundled Chromium. It does not build,
  install dependencies or download browsers. No system-browser/channel override.
- Angular analytics and persistent build cache are disabled. Build artifacts remain
  inside this package. There is no development-server requirement for the harness.

**Validated after the shared installation (2026-09-17):** `typecheck`, production
`build` and `test:smoke` pass. The initial adapter typecheck required an explicit
boolean annotation for its expected-selection variable (TS7022); no runtime UI
or accessibility changes were needed. The ignored optional native build scripts
for `@parcel/watcher`, `lmdb` and `msgpackr-extract` did not block the Angular build.
No additional dependencies or installations were needed.

The persistent Node-only smoke test includes faithful harness acquisition:

- Collect built assets into an in-memory base64 file map and use `BrowserSession`
  with local counts, this app's adapter and the pinned harness browser environment.
- Capture each state twice in fresh browser contexts and assess each unchanged raw
  HTML body using `assessOutput(html, state, html, 'html')`.
- Browsing passes **3/3 raw and strict semantic goals**; target-actions-available
  passes **5/5 raw and strict semantic goals**. No raw failures or scorer exemptions.
- Each state's two raw HTML outputs, full assessment objects and PNG screenshots
  are byte-identical (assessment equality is structural). No HTML normalization,
  screenshot masking or timing sleeps are used.
- Live interactions pass: supplier search, status filtering, record detail facts,
  local owner reassignment, original-owner restoration by reset, clear selection,
  a different record's contextual toolbar and deterministic reload preparation.
- No browser errors or external requests. Four tests pass (including the two state
  subtests), with zero failures, skips or cancellations.

These tests do not build a D2Snap subject, run compression, publish reports, modify
shared files or write capture artifacts. Oracle imports exist only in Node tests.
The README's commands reproduce these checks against the existing production build.

## UI and deterministic behavior

- Material toolbar, outlined cards, buttons, labeled Material form fields with
  native search/select controls, and focus-managed Material dialogs.
- AG Grid Community's client-side row model renders all three shared records in
  dataset order. Row/column virtualization and row animations are disabled. At the
  shared 1440 x 900 viewport all rows fit in the visible grid without scrolling.
  Normal grid header/cell roles and `aria-colindex` retain column relationships.
- Search matches any record fact, case-insensitively. The enabled native status
  select contains all four enabled options in the DOM and starts on All statuses.
- Click a row (or use AG Grid keyboard selection) for a single-selection command
  toolbar. Its accessible name is dynamically `Actions for <request ID>` for
  **every** record. Both actions operate on the selected row, never a hard-coded
  target. Clearing selection or changing filters removes the toolbar.
- View request opens the selected record's facts. Reassign owner opens a native
  owner select in a Material dialog, with owners derived from the shared corpus.
  Save updates only that record in memory; Cancel makes no change.
- Reset workspace restores source facts, empty search, All statuses, column state
  and no selection. Reload also deterministically clears all local state.
- Enterprise chrome includes supplier/cost-center directories, current queue
  counts, local-session metadata, operations notes and an expandable policy panel.
  Navigation links target actual page sections. No random values, application
  timers, remote fonts, storage persistence, network data or LLM calls.
- The Clawpilot theme script runs before application JavaScript. All application
  colors use the complete light/dark `--cp-*` palette, including Material theme
  and AG Grid overrides. Typography starts with Segoe UI and uses local fallbacks.
  `?clawpilotTheme=dark` or system preference selects the dark palette.

## Data and adapter boundary

Browser data comes **only** from `@perception-bench/scenarios`. The corpus retains:

| Request | Supplier | Amount | Status | Owner |
| --- | --- | --- | --- | --- |
| RQ-1041 | Acme Supplies | $2,400.00 | Approved | Jamie Chen |
| RQ-1042 | Acme Supplies | $1,200.00 | Overdue | Morgan Lee |
| RQ-1043 | Northwind Services | $1,200.00 | Pending | Jamie Chen |

`adapters/records.ts` default-exports `CellAdapter<Page>` with:

```text
caseId: records
stackId: angular-material-ag-grid
variantId: selection-toolbar
stateIds: browsing, target-actions-available
adapterModule: ./adapters/records.ts
```

The coordinator owns registration. The adapter's only contracts import is
**type-only**; the browser entry does not import the adapter, contracts, cases,
runner, registry, scorer or theme server module.

`prepare` reloads, waits for actual grid rows and controls, validates browsing,
and selects RQ-1042 only when preparing target-actions-available. `assertReady`
checks exact facts for all rows, header/cell associations, viewport fit, empty
query, enabled status options/current choice, explicit single-row selection,
closed dialogs, and visible enabled record-associated actions. It does not
merely check app mounting. The harness owns initial navigation, browser
environment and raw capture.

The smoke test additionally covers filtering, detail facts, local reassignment,
reset, clear selection, a different record's toolbar, browser errors and blocked
external requests. Harness-backed checks additionally score both raw states and
compare fresh HTML, assessments and screenshots. It writes no reports or shared artifacts.
