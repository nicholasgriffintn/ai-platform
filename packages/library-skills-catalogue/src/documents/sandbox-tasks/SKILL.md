---
name: sandbox-tasks
description: >-
  Dispatch work to the coding sandbox — implementing a feature, fixing a bug, refactoring, running a migration, writing docs, reviewing code, or running tests against a GitHub repository. Load before calling run_sandbox_task, to choose the task type and write a task the run can actually complete.
metadata:
  polychat-display-name: Sandbox tasks
  polychat-category: Development
  polychat-tags: "code, github, sandbox, review, tests"
  polychat-suggests-tools: "run_sandbox_task"
---

# Sandbox tasks

A sandbox run is unattended. Nobody is there to answer a question halfway through, so everything the run needs must be in the task you send. A vague task does not produce a vague result — it produces a confident wrong one.

Before dispatching, make sure you know the repository and what "done" looks like. Ask the user rather than guessing at either.

## Choosing the task type

The type decides whether the run may change files, so pick it from what the work _is_, not from how the user phrased it.

Read-only — the run cannot modify anything:

- **code-review** — judge existing code. Correctness, security, regressions, missing tests.
- **test-suite** — run tests and report what failed and why.

Write — the run may change files and, if asked, commit them:

- **feature-implementation** — new behaviour that does not exist yet.
- **bug-fix** — known wrong behaviour, where the fix should be minimal.
- **refactoring** — structure changes that must preserve behaviour exactly.
- **documentation** — docs that must match how the code actually behaves.
- **migration** — a mechanical change applied across many sites, done incrementally.

When a request spans two types, dispatch the narrower one first. "Review this and fix what you find" is a review, then a bug fix against what the review returned — not one write run that reviews itself.

## Writing the task

State the outcome, not the steps. The run can read the repository; it cannot read your mind about what counts as finished.

Include, when they apply:

- The specific behaviour that should exist afterwards, in terms someone could check.
- Where in the repository it belongs, if the user said or you know.
- Constraints that are not obvious from the code — a version to stay on, an interface that must not change, a pattern to follow.
- How to verify it: the test command, the case that currently fails, the thing that should stop happening.

Leave out anything you are guessing at. A constraint you invented is worse than one you omitted, because the run will honour it.

## Commits

`shouldCommit` defaults to off, and off is right unless the user asked for a commit or a branch. A run that commits without being asked leaves the user with work to undo.

Read-only types never commit, whatever is passed.

## Reporting back

The run streams events and returns a result. Do not replay the event log at the user.

Lead with whether the task succeeded and what changed. Then what the run could not do and why — a run that stopped short is the case where the detail matters. Point at the diff or the branch rather than pasting it, unless the change is small enough to read in the conversation.

If the run failed, say what failed and what would need to be different, rather than offering to try again with the same task.
