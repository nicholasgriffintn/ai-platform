# @ngriffin_uk/polychat-library-benchmarks

Polychat's fun benchmarks as pure definitions: frozen datasets, prompts, answer parsers, scorers, ratings and the safety gates that model-written HTML and Strudel must pass before anyone renders them. Nothing here touches storage, providers or the network. The API runs entrants, stores results and serves boards.

Keep this package server-side. Datasets carry their answers, so clients receive public items and reveals from the API instead.

Official runs on the public boards only go to the labs listed in `apps/api/src/config/benchmarks.ts`, on their own APIs. Aggregators, resellers and free tiers are skipped by the queue and cancelled by the runner, so a model holds one place per board and every receipt comes from the source. Personal runs can use any model the person can already run.

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

`scripts/build-geoguess-dataset.mjs` gathers Panoramax candidates near each city and, with a wider net, near each small town or rural road in its hard set, keeping only pictures in its reviewed allowlists. Pass a path to write every candidate for review, look at each picture before adding its id to an allowlist, and reject anything with burned-in coordinates, watermarks or no outdoor context. Photos are fetched, stripped of metadata and cached by the API at run time; none are committed. `scripts/build-world-outline.mjs` projects Natural Earth land into the Equal Earth outline the GeoGuess map draws.
