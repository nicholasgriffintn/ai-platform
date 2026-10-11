# ADR 0080: Resume interrupted delegations without repeating an unsettled effect

Status: Implemented for delegated teammate runs. Interactive turns keep the interrupted-reply salvage.

## Problem

A delegated run that loses its Durable Object lease, or whose Worker is evicted, was settled as interrupted and its delegation failed. The parent saw a failure for work that was often eight tool calls from done, and someone had to start it again by hand. Restarting naively is worse: the conversation then holds an assistant tool call with no result, which providers reject, and repeating that call could send, spend or write twice.

## Decision

When a delegation's run is interrupted while the delegation is still running, reconciliation resumes it instead of failing it, at most twice per delegation and only before its deadline.

- Every tool call the interrupted run issued without a stored result is settled with a synthetic tool result before anything else runs. A call whose declared effect (ADR 0071) is `read` is reported as not applied and may be repeated. Every other call is reported as of unknown outcome, and the model is told to check before repeating it, which is the same conservative rule ADR 0008 applies to unknown writes.
- The resumed run is a new run on the same child conversation, admitted through the normal teammate path with a new command identity. It inherits only the budget the interrupted run left: steps and credit already spent are subtracted.
- The interrupted-run sweep now hands teammate runs to the same reconciliation as runs that fail in process, so an evicted Worker no longer leaves its delegation running until the deadline.

## Consequences

Delegations survive deploys and evictions without a person noticing, and an interruption never turns into a duplicate effect on its own. The model may still choose to repeat a call it was told is unknown, so the guarantee is that nothing repeats automatically, not that nothing ever repeats. Interactive turns are unchanged: a person is present and the partial reply is kept as before. Resuming those, and project task runs, needs the same settlement and is a separate change.
