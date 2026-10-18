# ADR 0081: Corrections become placed rules

Status: Implemented.

## Problem

When someone corrects a teammate, the fix lands as a memory edit or a skill draft, and nothing remembers that a correction happened. Nobody can answer "what have you learned from me", nothing notices when the same correction comes back, and a second identical correction adds a second identical memory line instead of admitting the first did not hold. Unattended judgements have the same gap: when Poly keeps a result quiet, the person cannot see how close the call was, and disagreeing in chat changes nothing next time.

## Decision

A correction is a record of its own: the one-sentence rule, the person's quoted words, the conversation, where it was placed (`memory`, `skill` or `policy`, with its reference), how often it has recurred and whether it is still active. `propose_correction` is the only way to create one.

- The quote must appear in one of the person's recent messages in the same conversation, so a teammate cannot invent a lesson.
- Memory placement goes through the existing `store_memory` path. Skill placement saves a draft through the existing skill lifecycle, so nothing changes until the person accepts it.
- Before placing anything, the rule is compared with the person's active corrections, by exact match or a calibrated decision when one is available. A repeat in memory writes nothing new, counts the recurrence and tells the teammate to offer a skill instead. A repeat in a skill saves the draft and moves the record there.
- People see their rules as "Rules learned" and can forget one. Forgetting removes the record, not the memory or skill text it changed.

Decision policy receipts (ADR 0045) carry the options a judgement did not choose, with their probabilities, so a person can see the road not taken without the receipt copying the judged state. Disagreeing with one of Poly's quiet handoffs records a `policy` correction for that routine. While it is active, results from the routine skip the urgency judgement and are treated as high urgency, still inside the notification budget and daily cap. A correction only ever raises attention; it never bypasses budgets, approvals or the autonomy floor.

## Consequences

Corrections compound in one visible place, and a rule that keeps coming back is surfaced instead of silently duplicated. Records are personal, and project memory placement is not offered. Matching uses the twenty most recent active rules, so older ones are caught only by exact match. Only Poly's handoff judgement offers a disagree control, because it is the only unattended choice a person currently sees.
