# Turn continuity measurement plan

> Working planning artefact, not canonical architecture. Last updated 2026-09-05.

## Problem

[ADR 0024](skills/polychat-setup/references/architecture/decisions/0024-turns-outlive-the-connection.md) deliberately lets a stored turn outlive its SSE connection and has web and iOS recover the persisted answer. The former ADR 0039 is incorporated into ADR 0024 rather than maintained as a separate decision. We do not yet have representative production evidence showing how often detachment, recovery and cancellation succeed.

This plan instruments the accepted design through the existing [backend monitoring pipeline](../apps/api/src/lib/monitoring.ts). It does not add durable event replay, a second analytics channel or another client endpoint.

## Metrics

All three events use the completion ID as the existing analytics trace ID. It is not copied into metadata.

| Name                                     | Value                                 | Low-cardinality metadata                                                                                                                                 | Meaning                                                                       |
| ---------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `turn_continuity_finished`               | Total turn duration in milliseconds   | `platform`, `connection_state`, `detachment_reason`, `outcome`, `cancellation_observed`, `duration_before_detachment_ms`, `duration_after_detachment_ms` | One terminal observation for a streaming turn that reaches its cleanup path.  |
| `turn_continuity_cancellation_requested` | `1`                                   | `platform`                                                                                                                                               | An authorised cancellation request was written to KV.                         |
| `turn_continuity_recovery`               | Elapsed recovery time in milliseconds | `platform`, `outcome`, `attempt`, `final_attempt`                                                                                                        | One authorised recovery read. `outcome` is `pending`, `success` or `timeout`. |

Allowed platforms are `web`, `ios`, `api` and `unknown`. Mobile request values normalise to `ios`; every other unexpected value normalises to `unknown`. Detachment reasons are `reader_closed`, `write_failed`, `settle_failed` or `none`.

The API classifies a recovery as successful only when the authorised stored conversation contains more assistant messages than the client knew about when recovery began. It does not inspect or emit content. The recovery attempt number, elapsed time, final-attempt flag and known assistant count are client-reported observations, not server authority. Web recovery is wired through [turn-recovery.ts](../apps/app/src/lib/chat/turn-recovery.ts); iOS recovery is wired through [TurnRecovery.swift](../apps/mobile/ios/Polychat/Services/TurnRecovery.swift).

## Derived measures

- **Detachment rate:** detached terminal turns divided by all terminal turns, split by platform and outcome.
- **Post-detachment duration:** percentiles of `duration_after_detachment_ms` for detached turns.
- **Recovery attempts and latency:** deduplicate by trace, platform and client-reported attempt, then use the earliest observation. Calculate latency from the first deduplicated `success` or `timeout` per trace; never count raw event rows as attempts.
- **Recovery success rate:** distinct traces with a `success` recovery divided by detached, completed traces that made a recovery read.
- **Completed but not recovered:** detached, completed terminal traces with no `success` recovery after the three-minute recovery window and an ingestion grace period.
- **Cancellation observation:** distinct cancellation-request traces whose terminal metric has `cancellation_observed=true`. Use the earliest request timestamp per trace so repeated or no-op requests cannot enlarge the cohort. Request-to-terminal latency is the difference between that timestamp and the terminal event.
- **Surface difference:** calculate every rate and latency separately for web and iOS before combining them.

An iOS cancellation-request cohort is expected to be empty today because iOS has no response-stop control. That is a measured product difference, not an instruction to infer or add an interface. Recovery request failures can also prevent the final `timeout` poll from reaching the API, so use the absence-based completed-but-not-recovered cohort alongside explicit timeouts.

## Privacy and safety boundary

The implementation in [continuity-telemetry.ts](../apps/api/src/lib/chat/streaming/continuity-telemetry.ts) constructs metadata from an explicit allowlist. Do not add:

- prompt, response, reasoning, tool input or tool output;
- raw errors or credentials;
- user, workspace, provider or model identifiers;
- arbitrary client metadata or unbounded labels.

Recovery metrics are emitted only after the existing conversation read has authorised access. Cancellation metrics are emitted only after the existing cancellation service has authorised the conversation and written the request. Monitoring failures are caught and cannot change turn, recovery or cancellation behaviour.

Authorisation prevents cross-conversation disclosure, but these observations are replayable and the recovery dimensions above are client-authored. Analysis must join recovery and cancellation rows to one authorised terminal-turn trace, deduplicate using the rules above, and exclude traces without a matching terminal observation. Do not use raw row counts or client-reported elapsed time alone for product or architecture decisions.

## Evidence gate

Do not reopen the durability decision until one production cohort contains:

- 28 consecutive days of data;
- at least 1,000 detached, terminal stored turns;
- at least 200 detached turns from web and 200 from iOS;
- no known telemetry outage covering more than 5% of the cohort.

If those conditions are not met, extend collection rather than extrapolating from development or synthetic traffic.

### Current production cohort

An aggregate read of the configured production Analytics Engine dataset on 5 September 2026 found zero `turn_continuity_finished`, zero `turn_continuity_cancellation_requested`, and zero `turn_continuity_recovery` samples in the preceding 28 days. The same dataset contained other observations through `2026-09-05 01:50:55 UTC`, so this is a continuity-instrumentation cohort of zero rather than an unavailable analytics dataset.

This observation does not satisfy the evidence gate and does not justify reopening the replay decision. Re-check after the full cohort thresholds above are met.

## Criteria to reopen ADR 0024

Reopen the decision only when a qualifying cohort shows at least one of these conditions in two consecutive weekly slices:

- more than 1% of detached, completed turns have no successful recovery within three minutes;
- recovery success is below 99% on either web or iOS;
- successful recovery latency exceeds 30 seconds at p95 or 120 seconds at p99;
- fewer than 99% of authorised cancellation requests are observed by the detached turn before it finishes;
- web and iOS recovery success differ by more than two percentage points after each surface meets the minimum sample.

A high detachment rate alone does not justify durable replay. First address transport-specific disconnects or client polling when terminal persistence remains reliable. Consider changing ADR 0024's durability boundary only when failed recoveries are attributable to Worker lifetime, crashes or missing terminal persistence and cannot be corrected within the current persisted-result model.

## Replay decision

**Decision:** retain persisted-answer polling under ADR 0024. Do not implement token replay or semantic checkpoint replay.

The decision was completed as a development architecture review at the user's direction, without claiming that the zero-sample production observation above is representative evidence. The current implementation and tests establish the recovery mechanisms and their costs; they do not show measured user harm that would justify a second durable event system.

| Concern                              | Current polling design                                                                                                                                                                                                                                                                                                                        | Replay consequence                                                                                                                                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recovery success and latency         | The server continues finalisation after reader cancellation, while [web](../apps/app/src/lib/chat/__test__/turn-recovery.test.ts) and [iOS](../apps/mobile/ios/PolychatTests/ServiceStoreTests.swift) recover a newer persisted assistant message within a bounded window. This is behavioural evidence, not a production success-rate claim. | Replay would not repair a Worker that dies before persisting either the answer or a checkpoint. It would add a second recovery path whose benefit is unmeasured.                                                                                        |
| Durable Object and storage cost      | The coordinator serialises history writes and reports active work; normal history remains the durable result. Recovery adds bounded authorised reads only after transport failure.                                                                                                                                                            | Every replayable event needs ordered storage, retention, cursor reads and cleanup. Token events have the highest write volume; semantic checkpoints reduce volume but retain the same ordering and lifecycle machinery.                                 |
| Token versus semantic replay         | Ephemeral semantic activity already gives connected clients provider-neutral progress without becoming authority.                                                                                                                                                                                                                             | Token replay duplicates final message content and increases privacy exposure. Semantic replay is preferable to token replay if evidence ever justifies replay, but it still requires durable sequence numbers, terminal checkpoints and de-duplication. |
| Web reconnection                     | [Turn recovery](../apps/app/src/lib/chat/turn-recovery.ts) polls authorised stored history and the activity store marks the turn reconnecting without changing final assembly.                                                                                                                                                                | A replay client would have to merge buffered local deltas, replayed checkpoints and final stored history across refreshes without duplicating text or tool state.                                                                                       |
| iOS network and background behaviour | [TurnRecovery](../apps/mobile/ios/Polychat/Services/TurnRecovery.swift) owns bounded polling after transport failure; [ConversationManager](../apps/mobile/ios/Polychat/Services/ConversationManager.swift) keeps activity projection separate from recovered messages.                                                                       | Native clients would need persisted cursors, background-safe resumption and rolling fallback when the operating system suspends before a final cursor is saved. Replay cannot guarantee execution while suspended.                                      |
| Cancellation, ordering and locks     | Stop is an explicit authorised request; detached execution observes it, and final message writes remain under the conversation coordinator.                                                                                                                                                                                                   | Replay would need an ordering rule between cancellation, late provider/tool events, terminal checkpoints and the final D1 write. It cannot make already accepted external actions reversible.                                                           |
| Migration and rolling clients        | Older clients ignore additive activity and recover the stored answer, so current servers and clients interoperate.                                                                                                                                                                                                                            | Replay requires a versioned cursor contract, retention policy and fallback for clients that never acknowledge checkpoints. It must run alongside polling for at least one rolling-client window.                                                        |

This result reaffirms the existing ADR rather than changing it, so no new or superseding ADR is warranted. Reopen the decision only with evidence meeting the cohort and harm thresholds above; if that happens, prefer semantic lifecycle checkpoints over token replay and plan the migration separately from implementation.

## Known limits

- A Worker that terminates before the cleanup path cannot emit its terminal metric. Compare terminal metrics with stored conversation outcomes before interpreting absence as success.
- `waitUntil` remains best effort, KV cancellation remains eventually consistent, and recovery still reads the saved result rather than replaying events.
- Recovery and cancellation metrics are not an idempotent server ledger. The analysis rules above limit replay bias; stronger guarantees would require a separate bounded persistence design and evidence that this planning telemetry warrants it.
- Metrics describe operational cohorts, not individual user history. Do not expose trace-level data in product UI.
