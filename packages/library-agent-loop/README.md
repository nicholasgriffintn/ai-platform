# @ngriffin_uk/polychat-library-agent-loop

The agent decision loop: bounded steps, plan recovery, control tools, approvals, and action handler contracts. Hosts provide model decisions, action handlers, approvals, cancellation, and event reporting through `ExecuteAgentLoopParams`.

```ts
import { executeAgentLoop } from "@ngriffin_uk/polychat-library-agent-loop";

const result = await executeAgentLoop({
  initialMessages,
  initialPlan,
  shared,
  state,
  resolveTurn,
  executeToolCalls,
  emit,
  config,
});
```

`@ngriffin_uk/polychat-ai-agents` wraps this loop with tool catalogues and provider access; use that package unless you are building a new host.
