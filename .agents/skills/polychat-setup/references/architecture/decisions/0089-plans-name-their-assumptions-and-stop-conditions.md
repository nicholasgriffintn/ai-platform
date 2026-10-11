# ADR 0089: Plans name their assumptions and stop conditions

Status: Implemented for project tasks. Staleness sweeps and work-in-progress limits are not part of this decision.

## Problem

A project task's plan stage produces scope, steps and acceptance criteria. Nothing records what the plan assumed or what evidence should stop it, so work carries on until a goal stalls rather than until a condition someone agreed to while they were still impartial. When a task finishes or is abandoned, nobody checks which assumptions held, so the next plan repeats the same blind spots. Agent Prime's Planner makes both explicit: name assumptions and kill conditions before building, then audit the assumptions afterwards.

## Decision

A project task carries `assumptions` (up to ten statements) and `killConditions` (up to five). They are part of the task's record rather than its locked plan, so a plan stage can write them with `update_task` while the task runs. They cannot change once the task is done or cancelled.

- The shared stage instructions ask any stage in `plan` mode to record both, to find the weakest assumption and to run a short pre-mortem.
- After every run, a task with kill conditions has each one judged against what the run produced, as an independent `noul`. One at 0.8 or above blocks the task as `kill_condition_met`, with the condition as the detail, so it surfaces in Attention for a person to decide. No completion hands off and no council review runs. Without a decision model the check passes, so work is never stopped by an unavailable judge.
- When a task finishes as done or cancelled through any path (automatic hand-off, acceptance or an update), each assumption is judged `held`, `broke` or `unknown` against the task's results and stored as the task's `retrospective`. Without a decision model every assumption is recorded as unknown. A retrospective is written once.
- The task page and `get_task` show the assumptions, the stop conditions and, once finished, how each assumption held up.

## Consequences

Work stops on evidence the team chose in advance, and every finished task leaves a record of which of its assumptions survived. The judgements are calibrated decisions over the task's own outputs, so a stop or a retrospective is only as good as what the runs wrote down. Assumptions do not yet feed corrections (ADR 0085), because those record a person's own words. Agent Prime's staleness and work-in-progress rules need a scheduled sweep, since Attention is driven by task state rather than elapsed time, so they are left for a separate decision.
