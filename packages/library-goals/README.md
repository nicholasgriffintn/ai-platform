# @ngriffin_uk/polychat-library-goals

Goal lifecycle primitives: the actor-scoped status machine, the continuation policy that decides whether goal work keeps going, the progress journal cap, and the status labels. Contracts (`goalSchema`, status enums, request/response schemas) stay in `@ngriffin_uk/polychat-schemas`; this package owns the behaviour hosts apply to them.

```ts
import {
  appendGoalProgressEntry,
  assertGoalTransition,
  planGoalIteration,
} from "@ngriffin_uk/polychat-library-goals";

assertGoalTransition({ actor: "model", from: goal.status, to: "completed" });

const plan = planGoalIteration({
  goal,
  iteration: { producedEvidence: true, calledTool: true, awaitingUserAction: "approval" },
});

if (plan.status) {
  await goals.updateGoal(goal.id, {
    status: plan.status,
    stoppedReason: plan.stoppedReason,
    stallStreak: plan.stallStreak,
  });
}
```

## API

- `assertGoalTransition({ actor, from, to })` throws `GoalError("forbidden_transition")` for moves an actor may not make, or when the goal already ended. Actor scopes: `user` may `active | paused | cleared`, `model` may `completed`, `system` may `blocked | stalled | limit_reached`.
- `evaluateGoalContinuation(input)` is the single "does this goal keep working?" rule. It counts no turns: a goal that keeps producing evidence or calling tools runs indefinitely.
- `planGoalIteration({ goal, iteration })` wraps the rule and maps a stop to the next status and user-facing reason (`stalled`, `limit_reached`, `blocked`).
- `appendGoalProgressEntry(progress, entry)` appends and trims to `GOAL_PROGRESS_JOURNAL_LIMIT`.
- `goalStatusLabels` is the canonical status copy shared by the API transcript markers, `library-chat`, and the conversation UI.
