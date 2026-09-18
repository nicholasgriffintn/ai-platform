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

`defineStatusMachine` takes terminal states and the transitions each actor may make, and `assertTransition` refuses anything else with a `TaskError`. Errors carry a `code` (`lease_busy`, `ownership_lost`, `forbidden_transition`, `unknown_handler`, `duplicate_handler`) for the host to map.
