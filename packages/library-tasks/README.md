# @ngriffin_uk/polychat-library-tasks

Task engine primitives: outcome settlement with retry backoff, execution leases with renewal and ownership checks, a handler registry keyed by task type, and actor-aware status machines. Storage is a host concern, supplied through `LeaseStore`.

```ts
import {
  createExecutionLease,
  createTaskHandlerRegistry,
  defineStatusMachine,
  settleTaskFailure,
} from "@ngriffin_uk/polychat-library-tasks";

const lease = createExecutionLease({ store, taskId, ownerToken, initialExpiresAt });
await lease.assertOwned();

const handlers = createTaskHandlerRegistry<TaskHandler>();
handlers.register("summarise", summariseHandler);

const settlement = settleTaskFailure(error, { attempts: 2, maxAttempts: 5 });
```

`pollingSchedule` computes the next attempt, delay and `scheduledAt` for a self-rescheduling task and reports when the attempt cap is passed; `nextRunAt` and `parseInterval` answer when an interval or cron schedule fires next. `@ngriffin_uk/polychat-ai-workflows` composes these into `on`/`poll`/`every`.

`defineStatusMachine` takes terminal states and the transitions each actor may make, and `assertTransition` refuses anything else with a `TaskError`. Errors carry a `code` (`lease_busy`, `ownership_lost`, `forbidden_transition`, `unknown_handler`, `duplicate_handler`) for the host to map.
