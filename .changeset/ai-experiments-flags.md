---
"@ngriffin_uk/polychat-ai-experiments": minor
"@ngriffin_uk/polychat-library-flags": minor
"@ngriffin_uk/polychat-ai-providers": patch
"@ngriffin_uk/polychat-ai-workflows": patch
"@ngriffin_uk/polychat-schemas": patch
"@assistant/api": minor
---

Add the experimentation primitives. `library-flags` is an OpenFeature-shaped evaluation contract with a rules provider (deterministic bucketing from the targeting key, weighted splits, targeting, enable gates), a Cloudflare Flagship binding adapter and a layered provider that lets the dashboard override code. `ai-experiments` defines flags and experiments in code, assigns users with `feature_flag.evaluation` exposure events, runs work under an assignment, tracks outcomes with assignments attached, and runs offline variant sweeps with metrics. The API wires a per-request `Experiments` into the service context, tags AI generation telemetry with `experiment.<key>` properties, gates the flagged cron tasks through flags whose defaults come from the existing environment toggles, accepts an optional `FLAGS` Flagship binding, and serves `GET /flags/bootstrap`. Cron `enabledWhen` may now be asynchronous.
