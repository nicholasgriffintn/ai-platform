# @ngriffin_uk/polychat-ai-agents

Agent primitives built on `library-agent-loop`, `library-tools`, `library-workflows`, and `ai-functions`. `Agent` takes a definition (model, role, instructions, tools) and a `ProviderRuntime`, and returns an instance that can run the decision loop or call a single tool.

```ts
import { Agent } from "@ngriffin_uk/polychat-ai-agents";

const researcher = Agent(
  {
    name: "researcher",
    model: "claude-sonnet-5",
    role: "Research assistant",
    objective: "Answer with cited sources",
    tools: [webSearch, readPage],
  },
  providerRuntime,
);

const result = await researcher.run({ prompt, context, env, user });
const page = await researcher.do("read_page", { url }, context);
```

`buildAgentSystemPrompt` renders the role, objective and instructions, and `parseAgentToolCalls` normalises provider tool calls into `AgentToolCall`s. The package re-exports the loop (`executeAgentLoop`, approvals, control tools) and the workflow primitives so a host needs one import for agent work.

## Context management

`fitMessagesToContextBudget` trims a transcript to a model window, reserving output tokens, capping tool results and recording what was omitted in a `ChatContextSnapshot`; `applyReportedContextUsage` folds the provider reported usage back into that snapshot. `buildCompactionPlan` and `selectMessagesForSummary` decide which messages to archive behind a summary once a conversation grows, and `checkContextWindowLimits` / `pruneMessagesToFitContext` guard a single request. All of it is pure over messages, so hosts run it before any provider call.
