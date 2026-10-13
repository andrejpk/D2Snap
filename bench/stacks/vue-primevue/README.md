# Vue 3 + PrimeVue: purchase requests

Administrative register fixture for `records / vue-primevue / overflow-actions`.
Both `browsing` and `target-actions-available` are implemented by the default
`CellAdapter<Page>` export in `adapters/records.ts`.

## Dependency handoff

**The coordinator has completed the shared bench install.** This package
uses exact external versions; the only workspace dependency is browser-safe
`@perception-bench/scenarios: workspace:*`. No dependency installation, shared
manifest/lockfile/registry changes, browser installation, or commits are part of
this fixture handoff. The coordinator owns registration and the bench lockfile.

Runtime: Vue **3.5.16**, PrimeVue **4.3.5** (community, MIT).
Tooling: Vite **7.3.1**, plugin-vue **6.0.1**, TypeScript **5.8.3**,
vue-tsc **2.2.10**, @types/node **24.13.3**, Playwright **1.58.2**.
The package-specific TypeScript pin supports the matching vue-tsc release and
does not replace the harness toolchain.

After the coordinator completes the shared install, run from the repository root:

```powershell
pnpm --dir bench/stacks/vue-primevue typecheck
pnpm --dir bench/stacks/vue-primevue build
pnpm --dir bench/stacks/vue-primevue test:browser
pnpm --dir bench/stacks/vue-primevue dev
```

Vite serves `/fixture/` and builds `dist/index.html` plus local `dist/assets/*`.
For example, open `http://127.0.0.1:5173/fixture/?clawpilotTheme=light` with `dev`.
The harness, not the adapter, performs initial navigation and capture. The
adapter reloads the current fixture URL to reset all in-memory state. It waits
for component/data readiness, verifies the initial facts, and opens RQ-1042's
row menu only for the action state. Unknown states throw.

## Implementation

- Vue single-file components and reactive/computed local state. PrimeVue's real
  **DataTable, Column, Menu, Dialog, Button, InputText, IconField, InputIcon,
  FloatLabel, Toolbar, Panel, and Tag** components are used in supported
  **unstyled mode**, with Clawpilot CSS. No copied shadcn component or server
  theme code is bundled. No premium components or external assets/fonts.
- Horizontal workspace navigation, four aggregate summary cells, a request
  register, an operations guidance rail, and a collapsible help section give
  this app a distinct administrative layout. Chrome uses the shared scenario
  facts; computed aggregates come solely from the three shared records.
- A real unpaginated/nonvirtualized table renders all records with explicit
  Request / Supplier / Amount / Status / Owner / Actions headers. Seeded facts
  are imported unchanged. Search matches request facts case-insensitively;
  search and status filters combine. Reset filters clears both.
- Native status select in a PrimeVue FloatLabel layout intentionally keeps the
  enabled All statuses / Pending / Overdue / Approved options in the DOM.
  All statuses is selected and the enabled search is empty in both captures.
- Each row owns a PrimeVue popup Menu. Its trigger's actual `aria-expanded`
  state and `aria-controls` identify a unique popup for that request, including
  when PrimeVue teleports the menu to the body. This is ordinary accessibility,
  not a target-only marker. Both menu commands operate on that row's record.
- View request opens a real modal Dialog with all five request facts. Close or
  Escape dismisses it. Reassign owner opens a second Dialog with owners derived
  from the shared data. Cancel/Escape discard the draft; Save owner mutates only
  that record locally. Details reflect the new owner. Restore workspace and
  adapter reload restore the exact shared seed, filters, and closed dialogs.
- Segoe UI and Clawpilot light/dark CSS variables come from the
  web-artifacts-builder palette. Theme follows `clawpilotTheme=light|dark` or
  the browser color scheme. The harness fixes its environment to light. There
  are no runtime network calls, clocks, random state, local storage, or LLMs.

## Validation

Validated after the coordinator's shared installation on 2026-09-17:

```powershell
pnpm --dir bench\stacks\vue-primevue typecheck
pnpm --dir bench\stacks\vue-primevue build
pnpm --dir bench\stacks\vue-primevue test:browser
```

All three commands pass. The production build emits `dist/index.html` and local
assets. Vite reports a non-blocking large-chunk warning (approximately 636 kB
minified JS / 155 kB gzip); the fixture does not suppress that warning.

The persistent app-scoped `tests/records.test.ts` uses **Playwright 1.58.2's
bundled Chromium**, with no system-browser fallback or installation. It loads
the actual dist assets into a base64 file map and invokes the existing
`BrowserSession.capture` twice per state with the app's own adapter. Each
capture gets a fresh browser context and the harness-fixed environment.
`assessOutput(html, state, html, "html")` uses the unchanged records oracle.

| State | Raw goals | Strict semantic goals | Fresh-capture repeatability |
| --- | --- | --- | --- |
| browsing | 3/3 | 3/3 | HTML, screenshot bytes, and assessments identical |
| target-actions-available | 5/5 | 5/5 | HTML, screenshot bytes, and assessments identical |

The interaction checks serve the same build through the existing harness
server on an ephemeral port, block external requests, and cover:

- Every status choice, case-insensitive supplier search, combined search/status,
  empty results, and filter reset.
- View request on every row and exact detail facts.
- Target reassignment Cancel, Escape, and Save owner, including verifying
  every other request fact remains unchanged.
- Saved ownership in details and the detail-to-reassignment dialog handoff.
- Workspace restore, preparation from dirty filters/an open dialog, and popup
  Escape dismissal.
- No runtime errors, HTTP failures, or external requests.

An adapter boolean type annotation fixes the TypeScript inference error found
on the first installed typecheck. Raw captures had no failing goals. No app
semantics, shared oracle, or scorer changes were needed. A test-only dialog
label encoding typo found while extending coverage was corrected.

There are no remaining app validation blockers or additional dependency needs.
The coordinator owns central registration and generalized runner integration;
no shared demo/report command is part of this package validation. Tests import
harness/oracle modules only in Node; the browser imports shared scenario data
only. No generated report or capture is written outside this app directory.
