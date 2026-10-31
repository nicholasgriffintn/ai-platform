# @ngriffin_uk/polychat-library-flags

## 0.3.0

### Minor Changes

- 69adfec: Telemetry now runs on Cloudflare Basin. Server events, metrics and AI generation signals go to a Basin Pipelines stream through the `TELEMETRY_STREAM` binding, and the admin `/metrics` endpoint reads them back with Basin SQL. The Analytics Engine and Beacon sinks are gone, along with their exports and settings.

  Every row records the environment and app it came from (`api`, `web`, `desktop` or `ios`), with typed columns for identity, session, path, country, AI usage and flag exposures, and anything else under `properties`. Filter `/metrics` with `environment` and `app`.

  Web, desktop and iOS send product analytics, including page and screen views, to the API in small batches, without a third-party script. The API stores them under the caller's session identity.

  Flags have one interface on both sides. The API resolves Flagship and code rules through `library-flags`, and clients resolve the same assignments with `useFlag(key, defaultValue)`, backed by the new `createBootstrapProvider` and `GET /flags/bootstrap`.

  ```ts
  const tone = useFlag("chat-tone", "control");
  ```

## 0.2.6

### Patch Changes

- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-utility-core@0.9.0

## 0.2.5

### Patch Changes

- Updated dependencies [5d70d5d]
  - @ngriffin_uk/polychat-utility-core@0.8.0

## 0.2.4

### Patch Changes

- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-utility-core@0.7.0

## 0.2.3

### Patch Changes

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
  - @ngriffin_uk/polychat-utility-core@0.6.0

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
