# ADR 0086: Earn standing approvals and brake when the owner is away

Status: Implemented for Poly.

## Problem

ADR 0073 lets someone allow a Poly write ahead of time for one tool and destination, but nothing tells them when that would help. Someone who approves the same call every morning keeps answering the same card, and "Always allow here" looks the same on the first card as on the twentieth. The opposite gap is worse: a partner-level Poly, or one holding standing approvals, keeps writing on schedules and channel events while its owner is on holiday, and the only check on that work is the person who is not looking.

## Decision

Poly records the outcome of every approval card it raises for a write that could be allowed ahead of time. The record is an approval streak per tool and destination on the teammate context: approvals in a row, the last interaction counted and when it was approved. A rejection ends the streak, a streak not touched for fourteen days starts again, and an interaction is counted once however often it is resubmitted.

After five approvals in a row, the next card for that call puts "Always allow here" first and says how many times the person has approved it. It is still an offer. Granting stays a user-authenticated action through the existing route, and eligibility is still `isStandingApprovalEligible`, so the floor effects can never qualify.

The context also records when its owner was last seen: opening Poly or answering one of its approval cards. When a run is admitted for Poly and its owner has not been seen for seven days, a run the owner did not start is admitted at `assistant` at most and without standing approvals. Reads and drafts carry on, writes wait on the pending-approval rail, and the next visit lifts the brake because it marks the owner seen. Turns the owner starts are never braked.

The brake is applied at admission, where ADR 0073 already copies the context's live level into the run, so the Cedar policies do not change. It applies only to Poly, because other teammate contexts do not record when their owner was seen.

## Consequences

People find "Always allow here" when it would save them time rather than on the first card. A standing approval can no longer keep writing indefinitely for someone who has stopped reading what it does. Agent Prime's one-strike demotion is not adopted: a standing approval covers only `write` calls, and Polychat's restores cover local drafts rather than writes to other systems, so there is no reliable reversal signal to revoke on. People revoke from Poly's autonomy menu as before. A person who uses Polychat daily but never opens Poly will find unattended writes waiting after a week, which is the intended trade.
