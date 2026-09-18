# @ngriffin_uk/polychat-library-workflows

Workflow, event, schedule, and worker primitives with no runtime dependencies. A workflow is an ordered list of steps with per-step retry policy and resumable state, an event bus fans typed events to handlers, `runScheduledLoop` drives a job on a cron or interval, and a worker pairs a workflow with KPIs.

```ts
import { defineWorkflow, runWorkflow } from "@ngriffin_uk/polychat-library-workflows";

const publish = defineWorkflow({
  name: "publish",
  steps: [
    { name: "draft", run: async (context) => draft(context) },
    {
      name: "review",
      run: async (context, step) => review(step.results.draft),
      retry: { attempts: 2 },
    },
  ],
});

const result = await runWorkflow(publish, context, { state: savedState, persist: saveState });
```

`runWorkflow` throws `WorkflowPausedError` when a step asks to wait; persist `result.state` and call again to resume. `createWorker` binds a definition to an event bus and `scoreKpis` grades a run against its `KpiDefinition`s.
