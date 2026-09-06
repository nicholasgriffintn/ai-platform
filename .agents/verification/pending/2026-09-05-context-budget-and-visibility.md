# Context budget and visibility

Status: Pending manual verification.

## Setup

- Apply local migration 0024 and run the API with a stored personal conversation and a stored project-task conversation.
- Use an account that can load at least one skill and access a project source.
- Test web at narrow and wide widths, then the native app on a supported iPhone in light and dark appearance.

## Verify

- Start a run with an attached source, load a skill, and open **Context** after the run. Confirm both clients show the same run, model step, source, skill state, summary state and omission counts.
- Trigger compaction, add a later constraint, then continue with a supported model that has a smaller context window. Confirm the later constraint still affects the answer and the context view reports older omissions without claiming they remained in the prompt.
- Produce a tool result above 6,000 characters and continue to another model step. Confirm the answer can use the visible head and tail, the context view says **Tool result shortened**, and the stored conversation still exposes the full result to an authorised member.
- Compare a provider that reports input tokens with one that does not. Confirm the view says **reported** only for actual telemetry and **estimated** otherwise.
- Remove a composer source before submitting and confirm it is absent from the next run. Change curated project context and confirm the change applies to a later new project conversation without rewriting the existing one.
- Revoke source or project access and confirm the stored reference does not bypass the source endpoint or current workspace membership. Confirm no context view exposes tool arguments, credentials or private reasoning.
- Resume a waiting run and confirm the old attempt's context disappears until the successor records its own step.
- On web, verify the popover remains readable, scrollable and keyboard operable at narrow and wide widths. On iPhone, verify Dynamic Type, VoiceOver labels, scrolling and summary expansion keep usage and omissions reachable.
