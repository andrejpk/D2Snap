# React + Fluent UI v9: request operations

Implemented cell: `records / react-fluent / selection-toolbar`.
The coordinator owns registration, the shared lockfile, installation, and capture.
This package does not import a case, scorer, registry, or server module into the
browser. Its only data dependency is browser-safe `@perception-bench/scenarios`.

## Experience

A compact enterprise procurement console, rather than a shadcn layout copy:
application/module bars, live queue counts, a command strip, a dense Fluent
DataGrid, a triage desk, handling guidance, and a procurement reference directory.
All three synthetic requests retain their original identifying facts and order.

Real MIT-licensed `@fluentui/react-components` v9 components provide the DataGrid,
single-selection radio indicators, Avatar, Badge, Field, Input, Select, Toolbar,
ToolbarButton, Button, and Dialog family. Nothing requires a paid grid license.
The app-local Clawpilot CSS palette is bridged to Fluent theme tokens. Typography
uses installed Segoe UI/system fallbacks, not downloaded fonts. The optional
`clawpilotTheme=light|dark` URL parameter overrides the system color scheme.
No server-side theme module is imported into client code.

- Search matches request, supplier, amount, status and owner, case-insensitively.
- Status uses Fluent Select (real native options), retaining all four enabled
  choices in the DOM even while the control is closed.
- Every filtered result is mounted; there is no virtualization or pagination.
- A single selected row exposes `Actions for <request ID>`, linked with
  `aria-controls` to the grid. Selection is represented by both Fluent's radio
  input and the row's `aria-selected`. Cells retain column order and descriptions
  linked to their actual column headers.
- View request displays the current record facts. Reassign owner edits a local
  draft; Save updates the queue and owner counts, while Cancel/Escape discards it.
- Reset workspace, Reset filters, and reload restore the original dataset,
  empty query, All statuses, no selection, and no dialog. No storage, backend,
  network calls, timestamps, random data, or capture-affecting animations.

## Dependencies

Dependencies were installed centrally by the coordinator. No package or browser
installation is performed by this fixture's tests or authoring task.

Runtime pins:

| Package | Version |
| --- | --- |
| `@fluentui/react-components` | `9.54.0` |
| `react` / `react-dom` | `18.3.1` |
| `@perception-bench/scenarios` | `workspace:*` |

Development pins: `@types/react@18.3.23`, `@types/react-dom@18.3.7`,
`@types/node@24.13.3`, `typescript@6.0.3`, `vite@7.3.1`,
`playwright@1.58.2`. React 18 is deliberate for this Fluent v9 release's peer
compatibility; this does not change other stacks' React versions. All external
manifest versions are exact. Use the existing bench workspace with Node 24 and
pnpm 10.6.0; do not create an app lockfile.

## Commands after central installation

From the repository root:

```powershell
pnpm --dir bench\stacks\react-fluent typecheck
pnpm --dir bench\stacks\react-fluent build
```

Vite's configured base is `/fixture/`; the output is `dist/index.html` and local
hashed assets under `dist/assets/`. No framework Vite plugin is required for the
automatic React JSX transform. The runner owns production serving and navigation.
For optional local inspection, `pnpm --dir bench\stacks\react-fluent preview
--port 4186 --strictPort` serves the built fixture at
`http://127.0.0.1:4186/fixture/`.

The default export in `adapters/records.ts` implements `CellAdapter<Page>`:
`prepare` reloads and waits for actual rendered readiness, then selects RQ-1042
only for `target-actions-available`. `assertReady` checks all original record
facts, column associations, enabled search/filter and retained options, reset
values, mutually exclusive selection, absence of dialogs, and enabled contextual
actions linked to the selected grid. It rejects unsupported states. There are
no sleeps, navigation/server responsibilities, oracle imports at runtime,
test-only annotations, or scorer exceptions in the adapter.

### Production browser validation

After building, run the app-scoped tests without starting a separate server:

```powershell
pnpm --dir bench\stacks\react-fluent test:browser
```

`tests/capture.test.ts` loads only this app's `dist` assets into a base64 file map
and uses the shared `BrowserSession` with local counters. For each state it makes
two fresh captures, assesses each raw HTML output against the unchanged records
contract in explicit HTML mode, and requires raw and semantic retention of 3/3
for browsing and 5/5 for target-actions-available. It also requires byte-identical
raw HTML and full-page PNGs plus identical assessments. HTML/screenshot hashes
and byte counts are printed for diagnosis. The case and evidence imports are
Node-test-only; neither is part of the browser bundle or adapter runtime.

`tests/smoke.test.ts` serves the same assets using the shared `startServer` on an
ephemeral loopback port. It checks search/no-results, every status, both adapter
states, detail facts before/after reassignment, Cancel/Escape/Save, reset,
mutually exclusive selection, selection clearing on filtering, and reload after
saved changes/open dialogs. It waits for observable dialog dismissal instead of
assuming Fluent's portal disappears synchronously after a click.

Both tests use the pinned Playwright 1.58.2 bundled Chromium, reject external
requests, and close their own browsers/servers. They do not write shared reports,
caches, registrations, or configuration. They install no browsers or packages.
The harness capture path owns the shared viewport, locale, timezone, fixed clock,
random seed, and reduced-motion environment. No shared demo/report command runs.

Run only interactions with `pnpm --dir bench\stacks\react-fluent smoke`.
Optionally set `FLUENT_FIXTURE_URL` to an already served local `/fixture/` URL;
otherwise the smoke starts and closes its own ephemeral server.

Validated after central installation: app typecheck and production build;
raw/semantic 3/3 and 5/5 with no raw failures; two fresh captures per state with
identical HTML, full-page PNGs and assessments; real local interactions. The
production build emits upstream Fluent/Griffel module-level `use client`
directive warnings while successfully producing static assets.
