# ADR 0088: Judge project task work against an agreed bar

Status: Implemented for Outputs and project tasks. Staleness sweeps and work-in-progress limits are not part of this decision.

## Problem

A drafted Output could be sent or published with nothing between it and the world except an approval card, which shows the call's arguments but says nothing about whether the work is any good. A project task's plan also recorded scope and steps but not what it assumed or what evidence should stop it, so work carried on until a goal stalled, and nobody checked afterwards which assumptions held.

## Decision

A **council review** is its own operation over an Output revision, not a mode of the open `run_council` debate.

- Four fixed seats critique independently, then read each other's critiques and vote `ship`, `revise` or `hold`. A missing vote counts as `hold`.
- The synthesiser returns a verdict, a revision brief and any surviving dissent. It cannot ship over a revise or hold vote, and when its answer cannot be read the votes decide. Briefs from the last three reviews of the same Output kind in the same scope are fed back in.
- Reviews are appended to `output_review` against the revision they judged and never edited. People and teammates both go through `reviewOutput`, which checks Output access.
- A flow stage can hand off `on_council_ship`: up to three of its Outputs are reviewed, and the task advances only if every review ships. Otherwise, or with no Outputs or more than three, the completion waits for a person.

A project task carries **assumptions** (up to ten) and **kill conditions** (up to five) on its record rather than its locked plan, so a plan stage can write them while the task runs. After every run, each kill condition is judged independently; one at 0.8 or above blocks the task as `kill_condition_met` and surfaces it in Attention, with no hand-off or review. When the task finishes, each assumption is judged `held`, `broke` or `unknown` once and stored as its retrospective. Without a decision model, kill conditions pass and assumptions are recorded as unknown, so an unavailable judge never stops work.

## Consequences

Work can be held to an explicit bar before it leaves and can stop on evidence agreed in advance, with the reasoning visible on the Output or task. A review costs about nine auxiliary model calls, so it runs on request or when a stage asks. Verdicts and judgements gate stage hand-off only: sending still goes through approvals, and nothing here grants or removes authority. A stop or retrospective is only as good as what the runs wrote down.
