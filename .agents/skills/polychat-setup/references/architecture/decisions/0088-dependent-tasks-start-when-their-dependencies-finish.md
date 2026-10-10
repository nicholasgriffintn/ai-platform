# ADR 0088: Dependent tasks start when their dependencies finish

Status: Accepted.

## Problem

Project tasks can depend on other tasks, which already gives a board fan-out and joins. Starting a dependent task early blocked it with `dependencies_unmet`, and nothing ran it once the dependencies were done. Someone had to notice and press run again, and the dependent task started without seeing what its dependencies produced.

## Decision

Starting a task whose dependencies are unfinished records the person who asked as its runner identity and leaves it blocked. When a task becomes done, the board releases every blocked dependent whose dependencies are now all done, oldest board position first, up to the project's free concurrency. The released run uses the recorded runner identity, so membership, usage admission and tool grants are revalidated at dispatch exactly as for a manual start.

A task that nobody asked to start is never released. Neither is a task blocked for any other reason. Release is best-effort: a failure is logged and the task stays blocked for a manual start.

A dependent run receives the latest output of each finished dependency in its task context, capped per dependency and marked as untrusted reference material. Outputs of unaccepted or unfinished dependencies are never handed over.

## Consequences

Parallel lanes and joins come from the existing task graph instead of a second workflow runtime. A task blocked only because the project was at its concurrency limit waits for the next dependency to finish, or for a manual start. Releasing work under an identity recorded earlier is bounded to work that person explicitly asked to run.
