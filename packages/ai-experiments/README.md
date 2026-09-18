# @ngriffin_uk/polychat-ai-experiments

Two ways to learn which variant is better. Runtime experiments assign each user to a variant and tag everything they do with it, so outcomes in telemetry can be cut by variant. Offline experiments run every variant against the same input and score them, for prompt and parameter sweeps before anything ships.

## Runtime

```ts
import {
  createExperiments,
  defineExperiment,
  defineFlag,
} from "@ngriffin_uk/polychat-ai-experiments";

const tone = defineExperiment({
  key: "chat-tone",
  variants: {
    control: { temperature: 0.7, system: "You are helpful." },
    playful: { temperature: 0.9, system: "You are a witty parrot." },
  },
  control: "control",
  weights: { control: 1, playful: 1 },
  target: (context) => (context.plan === "free" ? "control" : undefined),
});

const experiments = createExperiments({
  provider,
  context: { targetingKey: "user:42", plan: "pro" },
  telemetry,
});

const reply = await experiments.run(tone, (config) => ai.generateText({ ...config, prompt }));

experiments.track("message.rated", { value: 1 });
```

`defineExperiment` gives typed variant configs; `defineFlag` covers booleans, strings, numbers and objects. `createDefinitionRegistry` turns definitions into `FlagRule`s for the rules provider in `library-flags`, so bucketing is computed from the targeting key and nothing needs configuring outside code. Layer a Flagship provider in front to pause or force variants from the dashboard.

`assign` resolves the variant, returns its config, and captures one `feature_flag.evaluation` exposure per variant per instance using the OpenFeature semantic convention properties (`feature_flag.key`, `feature_flag.result.variant`, `feature_flag.result.reason`, `feature_flag.provider.name`, `feature_flag.context.id`). `track` captures an outcome with every current assignment attached as `experiment.<key>` properties. `onAssign` lets a host copy assignments onto its request context so AI generation telemetry carries them too.

## Offline

```ts
import { gridVariants, runExperiment } from "@ngriffin_uk/polychat-ai-experiments";

const summary = await runExperiment({
  key: "summary-prompt",
  variants: gridVariants({ temperature: [0.2, 0.7], style: ["brief", "detailed"] }),
  concurrency: 2,
  execute: (config) => ai.generateText({ ...config, prompt }),
  metric: (result) => scoreSummary(result),
});

summary.best;
```

`runExperiment` runs every variant (with `concurrency`, `stopOnError`, `signal`), scores successful runs with `metric`, and reports `best` by `higherIsBetter`. Failures are recorded, not thrown. Each run and the summary are captured as `experiment.variant` and `experiment.completed` events when `telemetry` is supplied. `cartesian`, `cartesianCount` and `gridVariants` expand parameter grids.
