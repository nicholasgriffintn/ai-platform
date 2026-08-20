---
name: task-decomposition
description: >-
  Plan and run a request that needs several steps, several tools, or recovery when a step fails — a multi-part job, a request whose later steps depend on earlier results, or work that must continue sensibly after an error. Load before starting a request that cannot be satisfied by a single tool call or a single answer.
metadata:
  polychat-display-name: Task decomposition
  polychat-category: Reasoning
  polychat-tags: "planning, orchestration, tools, recovery"
---

# Task decomposition

Multi-step work fails in predictable ways: the plan is made once and never revised, steps run in an order that wastes results, or one failure ends the whole task when the rest of it was fine. This is how to avoid those.

## Plan before the first tool call

Write the plan down — briefly, for yourself and for the user. Three to six steps. Each one should name what it produces, because the next step's input is the previous step's output.

Mark each step as either:

- **Independent** — nothing it needs comes from another pending step. These run together.
- **Dependent** — it needs a specific earlier result. These run in order.

Run independent steps in one batch rather than one at a time. Sequencing work that had no reason to be sequential is the most common waste in multi-step tasks.

If the plan has more than about six steps, the task is probably two tasks. Say so and confirm the scope before spending the calls.

## Revise the plan when results demand it

The plan is a hypothesis. A step that returns something unexpected is information, not an inconvenience.

Re-plan when a result contradicts an assumption the later steps rest on, when a step reveals the goal was misunderstood, or when a cheaper route becomes available. Say what changed and why — a silently altered plan is indistinguishable from drift.

Do not re-plan because a step was merely harder than expected. Finish it.

## When a step fails

Work out which kind of failure it is before responding to it.

- **Transient** — a timeout, a rate limit, a momentary provider error. Retry once, and space the second attempt. Do not retry a third time; if it fails twice, treat it as persistent.
- **Persistent** — bad credentials, a missing resource, a malformed request, an unavailable capability. Retrying is pointless. Either fix the input and try once more, or route around it.
- **Fatal to the task** — the step was the point of the task and there is no alternative route. Stop and say so.

When a step is blocked but the rest of the task is not, finish everything else and report the gap explicitly. Partial completion with a named gap is useful; silent partial completion is not.

When you route around a failure — a different tool, a narrower approach, cached knowledge instead of a live lookup — say that you did and what the substitute cost in confidence. The user must not discover the workaround by noticing the answer is weaker than they expected.

## Branching

When the next step depends on a condition, evaluate the condition against actual results, not against what you expect the results to be. If you cannot yet tell which branch applies, that is a missing step: get the fact first.

Avoid speculative branches. Running both sides of a condition "to save time" doubles the cost and usually discards half the work.

## Reporting

At the end, say what ran, what it produced, and what did not happen. Keep it proportionate — a short summary for a three-step task, and a clear account of any step that failed, was skipped, or was substituted.

Never report a task as complete when a step was skipped or substituted. Scaling the work down is the user's decision, not yours.
