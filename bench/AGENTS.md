# Perception Bench authoring rules

Read README.md, AUTHORING.md, and the relevant section of DESIGN.md before
changing the corpus or fixture implementations.

- Work within the bench-local pnpm workspace. Do not migrate the root npm setup
  or modify D2Snap heuristics as part of a fixture/scorer change.
- Keep oracles in the harness-only `cases` directory. Fixture apps may import
  public scenario data, never requirements, expected answers or scoring logic.
- Keep contracts, scoring, cache and the future runner as modules of the `bench`
  project. Only shared browser-safe scenarios and stack apps need separate packages.
- Add goal-oriented case/state contracts before implementations. They share
  data, goals, states and evidence alternatives, not prescribed DOM/widgets.
  Register case/stack/variant identities; never add per-variant oracle exemptions.
- Do not inject correct-target markers or tweak D2Snap attribute scores to make
  a fixture pass.
- Pair every state with independent positive and negative scorer controls.
  Report incomplete matrix cells explicitly.
- Keep content/config/scorer identities complete. Never key an experiment by
  a branch name or config label alone.
- Run `pnpm --dir bench check` from the repository root for foundation changes.
  For capture/replay changes also run `test:browser`, `demo`, and a second
  `demo --assert-cached` invocation. Keep runtime model calls out of
  the benchmark; authoring agents are separate from deterministic execution.
