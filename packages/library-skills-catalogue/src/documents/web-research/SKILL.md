---
name: web-research
description: >-
  Plan and run deep web research with the paid research tool: sharpen a vague brief, pick the depth, and report the cited result. Load when the user wants market analysis, due diligence, a landscape or comparison, or any question that needs many public sources; do not load for a quick fact that web_search answers, or for questions about the user's own documents.
metadata:
  polychat-display-name: Web research
  polychat-category: Research
  polychat-tags: "research, web, sources, due diligence"
  polychat-suggests-tools: "research, web_search, ask_user"
---

# Web research

The `research` tool runs a slow, paid investigation across many public sources. A run on a vague brief costs the same as a run on a sharp one and returns a vaguer report, so spend a moment on the brief first.

## Check whether it needs research at all

Use `web_search` when one or two sources settle the question: a date, a price, a definition, a recent headline. Use `research` when the answer needs synthesis across many sources, comparison, or evidence the user will rely on.

Never send the user's private documents, messages or files to `research`. It is a public web tool.

## Sharpen the brief

A good brief names the question, why it matters, and its scope. Before running, check three things:

- **Angle**: which aspect matters? "EV charging" could mean market size, competitors, regulation or technology.
- **Purpose**: what decision or output is this for? An investment memo and a blog post want different evidence.
- **Constraints**: timeframe, region, sources to prefer or avoid.

If the conversation already answers these, run straight away. If one or more is genuinely ambiguous and a wrong guess would waste the run, ask with `ask_user`: at most three short questions in one go, each with likely options. Do not ask about anything you could reasonably assume, and say what you will assume if they skip a question.

## Choose depth and format

- `quick` for a short, sourced answer in a minute or two.
- `standard` for a thorough report. This is the default.
- `deep` only for exhaustive due diligence the user has asked for. It is the slowest and most expensive.

Use `format: "data"` with an `output_description` when the user needs fields to compare or reuse, such as a table of competitors with pricing. Otherwise use a report.

Write the brief into `input` in full, including the answers the user gave. The tool does not see the conversation.

## Report the result

Lead with the answer, then the evidence grouped by finding, citing the sources the tool returned. Keep figures, dates and qualifiers exactly as the sources state them. Say where sources disagree and which carries more weight. End with any gap that could change the conclusion, and offer a follow-up run only when a specific gap is worth paying for.
