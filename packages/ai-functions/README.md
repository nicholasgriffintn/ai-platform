# @ngriffin_uk/polychat-ai-functions

Task-shaped AI functions over a `ProviderRuntime`: text generation and structured output, plus `list`, `extract`, `classify`, `score`, `summarise`, and `is`, calibrated decisions through `decide`, media generation and transcription, and search, research, and guard retrieval. Hosts call these instead of building provider requests by hand.

```ts
import { createAiFunctions } from "@ngriffin_uk/polychat-ai-functions";

const ai = createAiFunctions(providerRuntime);

const title = await ai.generateText({ prompt: "Name this thread", model: "claude-haiku-4-5", env });
const labels = await ai.classify({ input: text, labels: ["bug", "feature"], env });
const { object } = await ai.generateObject({ prompt, schema, env });
const image = await ai.image({ prompt: "a parrot on a perch", env, user });
```

`complete` returns the text alongside the provider's `id`, `logId`, `citations` and `usage` when it reports them, plus the `raw` response. `generateObject` requests a JSON schema response, asks for strict mode only when every property is required, and validates the parsed result against the Zod schema.

`defineFunctions` turns a map of `{ name: { input shape, output shape } }` into typed callables backed by `generateObject`. `template` gives a tagged template that renders into `generateText`. Media functions route to the provider named on the request, then to the host default for that category.

## Decisions

`decide` sends a state and a map of typed questions to the account's decision model (TypeSafe Jev when `getAuxiliaryDecisionModel` resolves one) and returns answers typed by question id. `tryDecide` returns `null` instead of throwing when no decision model is available, which is how hot paths gate work without depending on the key. `choice`, `score` and `noul` build questions.

```ts
import { choice, noul } from "@ngriffin_uk/polychat-ai-functions";

const result = await ai.decide({
  env,
  user,
  state: { message },
  questions: {
    urgent: noul("Does `message` convey urgency?"),
    team: choice("Which team should handle `message`?", ["billing", "technical", "sales"]),
  },
});

result.answers.urgent.noul; // 0.97
result.answers.team.choice; // "billing"
```

`classify`, `score` and `is` use the decision model when one resolves and fall back to `generateObject` on the chat model otherwise, so callers get calibrated probabilities for free when a TypeSafe key is configured.
