# A correction improves the playbook

- **Change:** A `propose_skill_revision` tool saves a corrected playbook as a draft when the user corrects something a skill told the assistant to do. Nothing behaves differently until the user accepts the draft. Separately, a verdict can be recorded against a teammate, one per person per conversation, building a scorecard shown alongside its model and tools. Migration `0040` adds `teammate_feedback`.
- **Surfaces:** API. The teammate summary carries the scorecard; no UI control ships in this change.
- **Prerequisites:** Migration `0040`.
- **Risk if wrong:** A skill silently changing behaviour without being accepted, a revision proposed against a skill the user never corrected, or one person's verdict counted many times.
- **Commits:** This branch.

## Verify

- [ ] Correct something a skill told the assistant to do. Confirm it offers a revision, that the reply says it is a draft, and that the skill's live behaviour is unchanged until you accept.
- [ ] Accept the draft and confirm the next conversation follows the corrected playbook.
- [ ] Confirm the tool refuses a skill name that does not exist, rather than creating one.
- [ ] Record a good verdict against a teammate, then a bad one in the same conversation. Confirm the scorecard counts one, not two, and shows the later verdict.
- [ ] Record verdicts from two different people in the same conversation and confirm both count.
- [ ] Confirm someone who cannot read a teammate cannot record a verdict against it.

**Stop and report if:** a proposed revision changes a skill's behaviour before it is accepted, or one person's repeated verdict inflates a scorecard.
