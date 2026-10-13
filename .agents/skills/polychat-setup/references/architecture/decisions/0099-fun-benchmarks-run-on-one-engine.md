# ADR 0099: Fun benchmarks run on one engine with three scopes

Status: Implemented.

## Problem

Public leaderboards say a model is clever without saying whether it can place a street photo, reach a Countdown target or draw a hamster that actually runs. People also want to try the same tests on their own keys and on models deployed in Work, and admins need official numbers without a person pressing run for every new model. Work's eval suites are workspace-scoped, text in and text out, and keyed to routes, so they cannot hold images, artefacts, votes or public catalogue entrants.

## Decision

Benchmarks are curated, versioned definitions in `library-benchmarks`: frozen items, a prompt, a zod answer schema, a 0–1 scorer, reveals and optional metrics. Creative benchmarks declare an artefact and a judge rubric; artefacts only leave the API after passing a gate, and Strudel code must pass an allowlist grammar because it runs on our origin. Bumping a definition's version starts a new season and boards only compare runs on the same version.

One run engine in the `benchmarks` API module serves three scopes. Official runs use platform keys, are queued daily for lineup and decision models within a monthly budget, and are public. Personal runs use the person's access and keys, need Pro or their own key, are metered like chat turns, stay private and can be shared by link but never join the board. Workspace runs use active routes and record governance evidence on the model version. People can play the auto-scored benchmarks and form one pooled row.

Runs and votes live in two tables; per-item results, artefacts and stripped photos live in R2. Voted benchmarks rank by a Bradley–Terry fit refreshed every 15 minutes, seeded by a fixed judge until votes arrive. Ranks are shared when 95% intervals overlap. Boards join the Artificial Analysis indexes from the model catalogue with attribution, and the model list carries each model's standings for the selector.

## Consequences

Adding a benchmark is a definition and a registry entry. Datasets and answers are public in the repository, so contamination is possible and is answered by new seasons rather than secrecy. Workspace routes take text only, so image benchmarks skip them. Strudel patterns that need arrow functions or variables fail the gate by design.
