# ADR 0022: One turn engine

## Status

Accepted

## Context

ADR 0021 drew the line between capability and method and applied it to tools. It did not apply it to the pipeline underneath, which had grown four ways to run a turn.

Streaming chat ran a recursive transform: `createStreamWithPostProcessing` parsed the provider stream, executed tool calls, decided whether to continue, and on continuation nested another instance of itself inside the current stream. Buffered chat ran `runAgentLoop` over the shared `executeAgentLoop`. Agent modes ran the same loop again but wired differently, through `createAgentExecutionStream`. Multi-model ran a fourth path that spliced a primary stream and several buffered ones together by hand.

Each copy grew its own rules, and two of them had already diverged in ways nobody had noticed.

The goal finish gate was passed to the loop only on the non-streaming branch. Agent mode in the interface streams, so the path users actually hit could finish against an unsatisfied goal, while the gate worked on the path only API callers reach. Streaming chat had a second, separate implementation of the same policy in `goal-continuation.ts`.

The step budget came from two unrelated places. `evaluateTurnContinuation` resolved to a single tool round for ordinary chat unless a capability discovery had already run, in which case four; agent modes drew 8 to 48 from `AGENT_MODE_CONFIGS`. Nothing brought the two numbers into the same frame.

Memory classification ran inside the streaming turn's post-processing, so a run that took six tool steps classified six times. Its events were pushed into the turn's tool calls to render them, which made `toolCallsData` non-empty and silently skipped the goal-continuation branch guarded on it being empty.

The two paths also persisted differently. Streaming stored a full assistant message with parts, usage, citations and a guardrail record; buffered stored a thinner one and never persisted tool results at all.

## Decision

Make streaming a property of the turn rather than a pipeline of its own, and let `executeAgentLoop` run every chat turn.

A `ChatTurnTransport` resolves one model turn. The buffered transport asks the provider for a complete response. The streaming transport forwards deltas to the client as they arrive and hands back the assembled turn. Above that seam the loop owns the step budget, tool execution, persistence, usage limits and the goal contract, and cannot tell the two apart.

Split what `streaming.ts` did into parts that each do one thing. `consumeProviderStream` parses provider events and returns what the turn produced. `finaliseAssistantTurn` turns that into the stored assistant message and tells the client about it, and both transports finalise through it, so a streamed answer and a buffered one are persisted identically. `captureRunMemories` classifies once, after the run, and returns tool messages rather than forging tool calls on the assistant message.

Resolve the step budget in one place. `resolveTurnStepBudget` combines the request's own ceiling, the recipe and connector defaults, and the mode ceiling from `AGENT_MODE_CONFIGS`. Ordinary chat draws the chat mode budget like everything else.

Offer the loop's control tools where the loop can act on them. `update_plan` and `finish` reach the model in agent execution modes, so plan recovery, plan events and finish rejection stop being machinery judged against tools the model was never given.

Delete `streaming.ts`, `multiModalStreaming.ts`, `turn-continuation.ts` and `goal-continuation.ts`. Multi-model keeps its behaviour as `createModelEnsembleStream` on top of the unified engine.

## Trade-offs

Giving chat a real step budget makes ordinary turns cost more. That is the point — a single tool round was a limit nobody chose — but it is a spend increase visible in usage from the first commit rather than a neutral refactor.

The turn now runs inside a writer the loop drives, rather than a transform the provider stream is piped through. The event sequence a client sees is unchanged, and the recursion depth that grew with each tool round is gone, but the failure mode moves: an error now surfaces as an `error` event from the runner rather than propagating through a pipe.

Persisting buffered tool results is new. It is the correct behaviour — the conversation should record what the tools did — but non-streaming API callers will see history they did not see before.

Tool results that fail no longer end the turn. The streaming path used to stop on any result that was not continuable; the loop hands the failure back to the model, bounded by the step budget and the existing consecutive-failure and recovery limits. That is what an agent loop is for, and it is a behaviour change for chat.

A guardrail failure now persists the assistant message with the failed verdict attached, which is what streaming already did, rather than discarding it as the buffered path did. One of the two had to win; the one that actually runs did.

Skills are unaffected. The engine is where capability executes; ADR 0018 and ADR 0021 still decide what the model is told about it.
