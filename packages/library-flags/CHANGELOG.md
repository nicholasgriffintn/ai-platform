# @ngriffin_uk/polychat-library-flags

## 0.2.2

### Patch Changes

- Updated dependencies [8b2929f]
- Updated dependencies [7accf45]
- Updated dependencies [bf39c94]
- Updated dependencies [1fe4222]
- Updated dependencies [06c02dd]
- Updated dependencies [f4841cd]
- Updated dependencies [8b965f6]
  - @ngriffin_uk/polychat-utility-core@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [82c133e]
- Updated dependencies [393652d]
- Updated dependencies [7bec25b]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0

## 0.2.0

### Minor Changes

- 6db7a00: Add the experimentation primitives. `library-flags` is an OpenFeature-shaped evaluation contract with a rules provider (deterministic bucketing from the targeting key, weighted splits, targeting, enable gates), a Cloudflare Flagship binding adapter and a layered provider that lets the dashboard override code. `ai-experiments` defines flags and experiments in code, assigns users with `feature_flag.evaluation` exposure events, runs work under an assignment, tracks outcomes with assignments attached, and runs offline variant sweeps with metrics. The API wires a per-request `Experiments` into the service context, tags AI generation telemetry with `experiment.<key>` properties, gates the flagged cron tasks through flags whose defaults come from the existing environment toggles, accepts an optional `FLAGS` Flagship binding, and serves `GET /flags/bootstrap`. Cron `enabledWhen` may now be asynchronous.

### Patch Changes

- Updated dependencies [4968623]
- Updated dependencies [297b848]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
- Updated dependencies [90f7110]
- Updated dependencies [1df361b]
- Updated dependencies [57f8a16]
  - @ngriffin_uk/polychat-utility-core@0.3.0
