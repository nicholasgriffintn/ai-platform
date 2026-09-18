# @ngriffin_uk/polychat-ai-functions

Task-shaped AI functions over a `ProviderRuntime`: text generation and structured output, plus `list`, `extract`, `classify`, `summarise`, and `is`, media generation and transcription, and search, research, and guard retrieval. Hosts call these instead of building provider requests by hand.

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
