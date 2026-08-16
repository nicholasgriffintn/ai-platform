---
name: artifacts
description: >-
  Produce a substantial, reusable deliverable as an artifact instead of chat text: a document, report, letter or email; a runnable program or script; a single-file web page, interactive demo or visualisation; an SVG diagram or chart; or an edit to an artifact created earlier. Load when the user asks for any artifact or when a substantial deliverable should open beside the conversation.
compatibility: Requires Polychat's artifact tag renderer and sandbox.
metadata:
  polychat-display-name: Artifacts
  polychat-category: Output
  polychat-tags: "documents, code, html, svg, design"
---

# Artifacts

An artifact is a self-contained deliverable that opens beside the conversation instead of scrolling past inside it. The user can read it, edit it, copy it, download it, and come back to it later. Chat is for the conversation; artifacts are for the thing the conversation produced.

Artifacts are written as inline tags in your reply. There is no artifact tool — never call one, and never describe an artifact you did not emit.

## Decide first: does this earn an artifact?

Create one when the content is **substantial** (roughly fifteen lines or more), **self-contained** (it reads correctly with the chat removed), and **reusable** (the user will edit it, run it, send it on, or return to it).

Reach for an artifact for: reports, plans, briefs, essays, letters and emails the user will send, specs, runnable programs and scripts, single-file web pages, diagrams, and structured data the user will keep.

Do not use one for: a short snippet that illustrates a point, an explanation that only makes sense as an answer to this question, a one-off calculation, or anything the user asked to see inline. A three-line shell command belongs in a fenced code block.

When it is borderline, prefer chat. An artifact the user did not want is friction; a fenced block they wanted as a document is one follow-up away.

## Emitting one

```text
<artifact identifier="quarterly-review" type="text/markdown" title="Q3 review">
# Q3 review
...
</artifact>
```

- `identifier` — kebab-case, descriptive, stable. **Reuse the identifier to update earlier work**; pick a new one only for a genuinely new deliverable. Reusing it is what makes an edit an edit rather than a duplicate.
- `title` — a short human label shown on the artifact.
- `type` — load [the artifact types reference](references/types.md). When unsure, `text/markdown` for prose and `application/vnd.code` for code are always safe.
- `language` — required on code artifacts, e.g. `language="python"`.
- `display` — only meaningful on `text/html`; load [the artifact types reference](references/types.md).

Never wrap artifact content in triple backticks. The tag already delimits it.

## Rules that matter

**One artifact per message** unless the user asked for several, or the deliverable genuinely needs a code file plus its stylesheet.

**Write the whole thing.** Artifacts have no diff mechanism — a partial artifact replaces the full one. Never emit an ellipsis, a "rest unchanged" comment, or a truncated section. If a document is long, it is long.

**Say what it is.** One sentence in chat naming what the artifact contains and what to do with it. Do not restate its contents; the user can read it. Do not narrate the act of creating it.

**Handle selections.** When a user message contains `<artifact_selection>`, that is a highlighted passage from an existing artifact. Apply the change to that passage, leave the rest intact, and return the full artifact under the same identifier.

**Complete beats clever.** A page whose script throws, a document with placeholder headings, or a program that references a file that was never created is worse than a smaller thing that works. Every artifact must stand on its own.

## Sandbox limits

Rendered artifacts — HTML, React, SVG — run in a locked-down iframe. Loading [the artifact types reference](references/types.md) before writing one is required: the constraints there are enforced, and a page that violates them fails silently rather than degrading. In short: no network at runtime, images and fonts must be inlined as data URIs, and the only external script origin is cdnjs.cloudflare.com.

## Craft

Prose artifacts are documents, so give them a title, real headings, and paragraphs that carry an argument — not a wall of bullets. Match the register the user is writing in; a board update and a birthday message are not the same document.

Code artifacts are read before they are run. Name things for what they are, keep the structure obvious, handle the failure the user will actually hit, and leave out commentary that restates the line beneath it.

For anything with a visual surface — a page, a component, a diagram — load [the visual design reference](references/design.md) before you write it.
