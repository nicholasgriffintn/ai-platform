# @ngriffin_uk/polychat-ai-models

Model selection and policy on top of the catalogue: lookups by id, capability and modality, tier and lineup resolution, credential authority, reasoning and verbosity rules, and response defaults. Hosts import from here rather than keeping their own model tables.

```ts
import {
  getModelConfigById,
  getModels,
  getModelsByCapability,
  resolveDefaultChatModel,
  resolveTierModel,
} from "@ngriffin_uk/polychat-ai-models";

const model = getModelConfigById("claude-sonnet-5");
const vision = getModelsByCapability("vision");
const tierModel = resolveTierModel(getModels(), account, "balanced");
const fallback = resolveDefaultChatModel(getModels(), account);
```

`resolvePolicyModel` and `getExecutableModelsForAccount` answer what an account may run given its plan and stored credentials. `shouldEnableProviderThinking`, `resolveReasoningModel`, and `shouldSendProviderVerbosity` encode per-provider reasoning behaviour so providers do not carry those rules themselves. `applyModelResponseDefaults` fills request defaults from the catalogue entry.
