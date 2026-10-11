# ADR 0088: Council review gates outputs

Status: Implemented.

## Problem

`run_council` debates a question and ends in prose, and `audit_evidence` runs only when asked. A drafted Output can be sent or published with nothing between it and the world except an approval card, which shows the call's arguments but says nothing about whether the work is any good. Agent Prime's Agent Council showed a shape that works: independent seats, a second round in which each seat reads the others, one verdict of ship, revise or hold with a revision brief, and earlier verdicts on similar work fed back in.

## Decision

A council review is its own operation over an Output, not a mode of the open debate.

- Four fixed seats review the current revision: sceptic, researcher, customer and strategist, using their existing council member prompts. In round one each seat critiques independently. In round two each seat reads the others' critiques, concedes or presses its points, and votes `ship`, `revise` or `hold`. A seat that does not vote counts as `hold`.
- The synthesiser adjudicates. It returns a verdict, a revision brief and any dissent that survived the rebuttals. It may not ship over a seat that voted revise or hold, and when its answer cannot be read the seats' votes decide.
- The briefs from the reviewer's last three reviews of the same Output kind, in the same scope, go to the adjudicator, so a recurring weakness is named.
- Reviews are appended to `output_review` with the Output revision they judged. They are never edited, and a changed Output shows that its latest review is for an earlier revision.
- People ask for a review from the Output page. Teammates use the `review_output` tool. Both run through `reviewOutput`, which checks Output access.
- A project flow stage can hand off `on_council_ship`. When its goal completes, up to three of the stage's Outputs are reviewed, and the task advances only if every review ships. Otherwise the completion waits for a person, carrying the review identifiers. A stage with no Outputs, or more than three, always waits.

## Consequences

Work can be held to an explicit bar before it leaves, and the bar's reasoning is visible on the Output. A review costs about nine model calls on the auxiliary model, so it runs on request or when a stage asks for it, metered through the panel's usage path. The verdict is advice and a gate on stage hand-off only. Sending still goes through the existing approvals, and nothing here grants or removes authority.
