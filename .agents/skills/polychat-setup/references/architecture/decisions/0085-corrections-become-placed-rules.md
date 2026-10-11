# ADR 0085: Corrections become placed rules

Status: Implemented.

## Problem

When someone corrects a teammate, the fix lands as a memory edit or as a skill draft, and nothing remembers that a correction happened. Nobody can answer "what have you learned from me", nothing notices when the same correction comes back, and a second identical correction adds a second identical memory line instead of admitting the first one did not hold. Agent Prime's learnings loop showed the useful distinction: capture the pattern rather than the fix, and know where the rule lives, because a rule in a playbook holds better than a rule in a memory file.

## Decision

A correction is a record of its own: the one-sentence rule, the person's quoted words, the conversation, where it was placed (`memory` or `skill`, with the skill name or memory document), how many times it has recurred and whether it is still active. The `propose_correction` tool replaces `propose_skill_revision` and is the only way to create one.

- The quote must appear in one of the person's recent messages in the same conversation, so a teammate cannot invent a lesson.
- The memory placement goes through the existing `store_memory` path: teammate memory reflection for a bound teammate, personal memory otherwise. The skill placement saves a draft through the existing skill lifecycle, so nothing changes until the person accepts it.
- Before placing anything, the tool compares the rule with the person's active corrections: an exact match after normalising, or a calibrated `choice` when a decision model is available, with a 0.7 threshold. Without a decision model it uses exact matching only.
- A repeat placed in memory again writes nothing new. It counts the recurrence and tells the teammate the rule is not holding where it lives, so it should offer a skill. A repeat placed in a skill saves the draft and moves the record to the skill.
- The person sees their rules under Files › Sources as "Rules learned" and can forget one. Forgetting removes the record. The memory or skill text it changed stays until the person edits it.

## Consequences

Corrections compound in one visible place, and a rule that keeps coming back is surfaced instead of silently duplicated. Records are personal, keyed to the user who made the correction, and project memory placement is not offered yet. Matching against the twenty most recent active rules keeps the decision request small. Older rules are only caught by exact matching.
