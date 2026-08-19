---
name: council
description: >-
  Pressure-test a contested decision, design, plan, or strategy by putting distinct adversarial perspectives against it before answering — a sceptic, an architect, a strategist, a security reviewer, and others. Load when the user asks for a council, asks for multiple perspectives or a debate, or brings a consequential choice where the obvious answer deserves challenge.
metadata:
  polychat-display-name: Council
  polychat-category: Reasoning
  polychat-tags: "debate, perspectives, decisions, review"
  polychat-suggests-tools: "run_council"
---

# Council

A council exists to find the objection nobody in the room has raised. It is expensive and slow, so it is worth convening only when a single considered answer would plausibly be wrong in a way the user could not detect.

## Convene one when

- The decision is hard to reverse — an architecture, a hire, a migration, a contract.
- Reasonable experts would disagree, and the user has only heard one side.
- The user has already decided and wants the case against it tested.
- The question spans domains that pull in different directions: cost against safety, speed against maintainability.

## Do not convene one when

- The question has a retrievable answer. A council on a fact is theatre.
- The user wants a quick opinion. Give them the opinion.
- The task is execution, not judgement.
- You would be inventing disagreement to fill the roster. Two members who genuinely conflict beat five who take turns agreeing.

When it is borderline, answer directly and say which part you would take to a council if the user wants that.

## Running it

Call `run_council` with the question stated in full — the members do not see the conversation, only what you pass.

Choose members who will actually collide on _this_ question. The tool's schema lists the roster; three or four is usually right, and more than that dilutes rather than deepens. A security question wants `security` and `operator`; an architecture question wants `architect` and `sceptic`; a product bet wants `strategist`, `customer`, and `contrarian`. Include `synthesiser` when the threads need pulling together, and `joker` or `wildcard` only when the problem has gone stale and needs reframing.

Order matters: the first member speaks blind, and each one after reads the transcript. Put the perspective that sets the frame first and the one that integrates last.

If you do not pass members, the tool convenes a sensible default.

## Using what comes back

The tool returns the transcript and the chamber's conclusion. Neither is your answer — they are input to it.

- Lead with the answer the council reached and what changed your view, not with a summary of the proceedings.
- Name a member only when their specific objection survived and matters to the user. "The security reviewer flagged X" earns its place; "the strategist agreed" does not.
- Keep dissent that a reasonable person would still hold. Flattening it into consensus destroys the reason for convening.
- If the council was wrong or missed something you can see, say so. You are not bound by it.
- If the debate did not settle the question, say what would settle it. That is a useful result, not a failure.

Do not paste the raw transcript into your reply unless the user asks to see it.

## Without the tool

If `run_council` is unavailable, you can still run the chamber yourself in one pass: take each perspective in turn, make each one raise a real objection to what came before, then write the conclusion. Keep the same discipline — the value is in the disagreement, not in the labels.
