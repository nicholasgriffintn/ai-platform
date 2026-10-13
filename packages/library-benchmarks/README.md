# @ngriffin_uk/polychat-library-benchmarks

Polychat's fun benchmarks as pure definitions: frozen datasets, prompts, answer parsers, scorers, ratings and the safety gates that model-written HTML and Strudel must pass before anyone renders them. Nothing here touches storage, providers or the network. The API runs entrants, stores results and serves boards.

Keep this package server-side. Datasets carry their answers, so clients receive public items and reveals from the API instead.

```ts
import { getBenchmark, rankBySignificance } from "@ngriffin_uk/polychat-library-benchmarks";

const countdown = getBenchmark("countdown");
const prompt = countdown.prompt("round-01");
const answer = countdown.parseOutput(modelText);
const { score, detail } = countdown.score("round-01", answer);
```

## Add a benchmark

- Add its id to `BENCHMARK_IDS` in `@ngriffin_uk/polychat-schemas`.
- Write a definition with `defineBenchmark`: summary, items, a zod answer schema, `prompt`, `parse`, `score` (0–1 per item), `reveal` and optional `metrics`.
- Set `scoring: "votes"` with an `artefact` and `judgeRubric` for creative benchmarks. Artefacts only leave the API when `score` passes the gate.
- Add `decision` and `fromDecision` when decision models can answer it, and `playable` when people can.
- Bump `version` whenever items, prompts or scoring change. Boards only compare runs on the same version.
- Register it in `src/registry.ts`.

## Datasets

`scripts/build-geoguess-dataset.mjs` gathers Panoramax candidates near each city and keeps only pictures in its reviewed allowlist. Pass a path to write every candidate for review. Photos are fetched, stripped of metadata and cached by the API at run time; none are committed. `scripts/build-world-outline.mjs` projects Natural Earth land into the Equal Earth outline the GeoGuess map draws.
