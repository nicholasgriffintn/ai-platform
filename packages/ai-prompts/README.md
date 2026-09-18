# @ngriffin_uk/polychat-ai-prompts

Prompt retrieval and composition over the prompt catalogue. Get a prompt by id or task, render templates with variables and conditionals, or build the composed prompts that Polychat sends to models.

```ts
import {
  buildStandardChatPrompt,
  getPromptText,
  renderPrompt,
} from "@ngriffin_uk/polychat-ai-prompts";

const safety = getPromptText("chat/safety");
const answer = renderPrompt("apps/web-search/answer", { contexts });

const prompt = buildStandardChatPrompt({
  assistantName: "Polychat",
  assistantDescription: "A multi-model assistant.",
  model: { modelId: "gpt-5", supportsToolCalls: true },
  userContext: { date: "2026-09-18" },
  skills: [{ id: "artifacts", description: "Self-contained deliverables." }],
});
```

- `getPrompt` / `getPromptForTask` throw `PromptNotFoundError`; `tryGetPrompt` returns `undefined`.
- `renderPrompt` throws `PromptRenderError` when a required value is missing and `PromptTemplateError` for malformed templates.
- Builders cover the composed chat system prompt, meta-assistant, sandbox controller, memory and document prompts, agent system prompts, sandbox-worker prompts and provider prompts. `PromptBuilder` is exported for custom compositions.

All prompt text lives in [`@ngriffin_uk/polychat-library-prompts-catalogue`](../library-prompts-catalogue); this package never stores prompt copy.
