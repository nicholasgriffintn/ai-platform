---
name: prompt-craft
description: >-
  Diagnose and rewrite a prompt, system prompt, agent instruction, or instruction template that a language model will follow. Load when the user asks to improve or shorten a prompt, asks why a prompt keeps producing the wrong output, or asks you to write instructions another model or agent will act on.
metadata:
  polychat-display-name: Prompt craft
  polychat-category: Reasoning
  polychat-tags: "prompts, instructions, writing, agents"
---

# Prompt craft

The user is writing instructions that a model will follow. Your job is to make those instructions produce the output they actually want — not to admire the prompt, and not to pad it.

## Work out what kind of prompt it is first

The failure modes differ, so name the type before you touch anything.

- **Creative** — the risk is blandness. Weak on voice, constraint, and concrete detail.
- **Technical** — the risk is ambiguity. Weak on inputs, versions, environment, and definition of done.
- **Instructional** — the risk is gaps. Weak on prerequisites, ordering, and verification.
- **Analytical** — the risk is shapelessness. Weak on evaluation criteria, data available, and output format.
- **Agentic** — the risk is unbounded action. Weak on stop conditions, tool boundaries, and what to do when blocked.

## Diagnose before rewriting

Read the prompt against the output the user is getting. Most broken prompts are broken in one of these ways, and naming which one is more useful than a full rewrite:

- **Buried instruction** — the real requirement is in the middle of a paragraph, competing with context.
- **Unstated success criterion** — the user knows what "good" looks like and never wrote it down.
- **Conflicting constraints** — "be comprehensive" and "keep it under 100 words" in the same prompt.
- **Missing negative space** — nothing says what to leave out, so the model includes everything.
- **Example-free abstraction** — an adjective ("professional", "concise") standing in for a demonstration.
- **Wrong altitude** — micromanaging a capable model, or hand-waving at a task that needs specifics.

If the prompt is fine and the _model_ or the _context_ is the problem, say so. Rewriting a working prompt wastes the user's time.

## Rewriting rules

- Lead with the task. Context supports the instruction; it does not precede it by three paragraphs.
- Replace adjectives with constraints. "Concise" becomes a length; "professional" becomes a named audience or a sample sentence.
- State the output shape explicitly when the output feeds something else — a schema, a heading structure, a field list.
- Add one worked example when the task is a judgement call. Skip examples for mechanical tasks; they cost tokens and anchor the model narrowly.
- Say what not to do only where the model plausibly would. Blanket prohibitions are noise.
- Cut anything the model already does by default. Politeness instructions, "think step by step" on a reasoning model, and "you are a helpful assistant" earn nothing.
- Keep the user's voice and their domain vocabulary. You are editing their prompt, not substituting your own.

For agentic prompts, also pin down: which tools are in scope, what counts as done, what to do when a step fails, and when to stop and ask rather than guess.

## What to return

Give the rewritten prompt in a fenced block so the user can copy it, then a short account of what you changed and why. Three or four specific points beat a checklist.

If the prompt was already close, say so and offer the smallest edit that fixes it. A rewrite the user has to diff against their original is worse than a targeted change.

Do not iterate on your own rewrite unless the user asks. One good revision plus the reasoning behind it is the deliverable.
