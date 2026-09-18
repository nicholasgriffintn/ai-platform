# @ngriffin_uk/polychat-ai-workflows

Declare background work in three verbs and let the host wire the queue and the cron trigger once. `on` registers a queued task with a validated payload, `poll` registers a task that re-queues itself with backoff until a job settles, and `every` registers a cron job. Nothing here knows about D1 or Cloudflare Queues: the host supplies a `TaskQueue` and calls `handlers()` from its queue consumer and `runCron()` from its scheduled handler.

```ts
import { createWorkflows, PENDING } from "@ngriffin_uk/polychat-ai-workflows";
import { z } from "zod/v4";

const workflows = createWorkflows<Env, TaskType>({
  queue: (env) => ({ enqueue: (request) => taskService(env).enqueueTask(request) }),
});

workflows.on("usage_rollup", {
  payload: z.object({ events: z.array(usageEventSchema) }),
  handle: async ({ events }, { env }) => {
    const { inserted } = await applyUsageRollup(runtime(env), events);

    return { status: "success", data: { inserted } };
  },
});

workflows.poll("replicate_polling", {
  payload: z.object({ predictionId: z.string(), userId: z.number() }),
  maxAttempts: 40,
  check: async ({ predictionId }, { env }) => {
    const status = await readPrediction(env, predictionId);

    return status === "processing" ? PENDING : { status: "success" };
  },
});

workflows.every("0 4 * * *", {
  name: "infra-reconciliation",
  run: ({ enqueue }) => enqueue({ task_type: "infra_reconciliation", task_data: {} }),
});

workflows.always({ name: "task-recovery", run: ({ env }) => recoverStuckTasks(env) });

export default {
  queue: (batch, env) => executor(env, workflows.handlers()).process(batch),
  scheduled: (event, env) => workflows.runCron(env, event),
};
```

## Tasks

`on(type, { payload, handle })` parses `task_data` with the Zod schema and throws a `TaskError("invalid_payload")` when it does not match, so handlers never see a half-formed payload. `handle` receives the parsed payload and a `TaskContext` with `env`, the raw `message`, the `execution` lease details and `enqueue` for follow-up work. Returning nothing means success; throwing lets the host executor settle the retry. `on(type, { handle })` without a schema hands over the raw record for tasks that carry opaque data. `register(type, handler)` accepts a host-shaped `TaskHandler` for tasks that need the low-level contract.

## Polling

`poll(type, { payload, check, delaysSeconds?, maxAttempts?, onExhausted? })` calls `check` and, when it returns `PENDING`, re-queues the same task with the next attempt in `task_data.pollAttempt` and a `scheduled_at` from `pollingSchedule` in `library-tasks`. The default delay table is 5, 10, 20, 30, 30 seconds and the default cap is 60 attempts; once the cap is passed the task fails (or `onExhausted` decides) rather than polling forever.

## Schedules

`every(cron, { name, run, enabledWhen? })` registers a job for one cron expression; several jobs can share an expression. `always({ name, run })` registers a job that runs on every cron tick before the matching jobs. `runCron(env, event)` runs the `always` jobs, then the jobs for `event.cron`, isolates each failure, logs it, and returns a `CronRunReport` listing what matched, what was skipped by `enabledWhen`, and what failed.
