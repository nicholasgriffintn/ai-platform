# ADR 0087: Receipts show the road not taken

Status: Implemented for decision policy receipts and Poly's quiet handoffs.

## Problem

Decision policy receipts (ADR 0045) record the recommendation, its confidence and the provider, but not what else the judgement considered. When Poly keeps a routine result quiet, the person sees "noted quietly" and nothing about how close the call was, and the only way to disagree is to say so in chat, which changes nothing next time. Agent Prime's Judge logs every discarded option and turns each disagreement into a rule. We want the same accountability without letting a model's self-reported confidence grant anything.

## Decision

Every evaluated decision policy receipt carries `alternatives`: for each `choice` question, up to two options the judgement did not choose, with their probabilities, ignoring anything under five per cent. The probabilities come from the decision provider's answer, so this costs nothing extra, and receipts still never copy the judged state.

Poly's agenda shows each quietly noted handoff with its judgement, for example "Judged normal (71%) over high (22%)", and a "Tell me next time" control. Choosing it records a correction (ADR 0085) with the placement `policy` and the reference `poly.handoff_urgency:<installation>`. While that rule is active:

- results from that routine skip the urgency judgement and are treated as high urgency, so they still pass through the notification budget and the daily cap;
- the routine's earlier quiet handoffs leave the "Noted quietly" list, since the person has now looked;
- the rule appears in Rules learned and can be forgotten like any other.

A second disagreement about the same routine counts as a recurrence on the existing rule.

## Consequences

People can see how close a quiet decision was and correct it with one click, and the correction lands in the same ledger as every other taught rule. The override only raises urgency. It never bypasses budgets, approvals or the autonomy floor. Other decision policies gain alternatives in their receipts, but only Poly's handoff judgement offers a disagree control so far, because it is the only unattended choice the person currently sees.
