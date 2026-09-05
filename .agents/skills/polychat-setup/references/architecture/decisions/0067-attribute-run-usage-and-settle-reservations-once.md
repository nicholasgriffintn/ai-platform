# ADR 0067: Attribute run usage and settle reservations once

## Problem

One stored run can span retries, devices and durable-owner recovery. Conversation-level usage cannot explain which attempt consumed resources, while a held estimate can be mistaken for actual spend. Missing provider telemetry must not become a zero-cost claim, and duplicate completion or ownership loss must not apply settlement twice or leave a hold indefinitely.

## Decision

Attach the stable run ID and exact attempt to model, hosted-tool and capability ledger events. Aggregate those immutable events under the run while keeping three concepts separate: the admission reservation is a temporary estimate, ledger events are actual recorded consumption, and reservation settlement is the single idempotent release of that hold. Missing provider telemetry remains `unknown`; an estimated context count is not actual consumption.

The assistant-turn finaliser is the normal settlement authority. It marks a reservation settled only after usage is written or durably queued, and releases it when usage is missing or fails to record. Cancellation, terminal failure and durable-owner recovery may release an unfinished hold through the same compare-and-set repository path. Chat-run holds expire after 24 hours and scheduled maintenance releases expired holds, bounding orphan recovery without changing admission or billing policy.

Emit existing Analytics Engine signals for duplicate commands, recovery, ownership loss, approval and cancellation latency, and uncertain connector writes. Include identifiers, attempt, classification and duration only; never include prompts, message content, tool arguments, credentials or provider payloads.

## Status

Implemented.

## Consequences

Web and iPhone can show one coherent usage history across attempts and clearly label reserved estimates, recorded credits and settlement. Ledger entries created before this change have no run identity and remain in account or workspace reporting rather than being guessed onto a run. Providers that omit usage remain visibly unknown, and queued ledger processing can briefly show a settled reservation with consumption still processing.
