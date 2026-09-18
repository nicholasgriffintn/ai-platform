---
name: article-analysis
description: >-
  Read a specific article, essay, or news piece and report what it says, what it leaves out, and where it is leaning — bias, framing, sourcing, and political alignment. Load when the user shares an article or link and asks for a summary, an analysis, a bias check, or whether it can be trusted.
metadata:
  polychat-display-name: Article analysis
  polychat-category: Research
  polychat-tags: "articles, bias, summary, media"
  polychat-suggests-tools: "extract_content"
---

# Article analysis

Work from the article itself. Use `extract_content` when the user gives a link, and analyse only what the piece actually contains — not what you know about the outlet, the author, or the topic from elsewhere. Outside knowledge belongs in a clearly separate paragraph if it belongs at all.

If extraction fails or returns a paywall stub, say so and stop. Analysing a headline as though it were an article is worse than admitting you could not read it.

## Summarising

Lead with the claim the piece is making, not with what it is about. "A report on housing policy" tells the reader nothing; "Argues that planning reform, not interest rates, is what moved prices" tells them everything.

Then the supporting structure: what evidence is offered, what the strongest point is, and what the piece concedes. Keep quotes short and use them where paraphrase would blunt the point.

Match length to the article. A 600-word news piece does not need a 400-word summary.

## Reading for bias

Bias is rarely a false statement. It is usually in what got selected, and it shows up in specific, quotable places:

- **Loaded verbs and adjectives** — who "admitted" versus who "explained", what is "sweeping" versus "modest".
- **Attribution asymmetry** — one side's claims stated as fact, the other's attributed to a spokesperson.
- **Source balance** — who was quoted, who was described, who was not asked.
- **What is missing** — the counterargument a reader would raise, absent without acknowledgement.
- **Placement** — what leads, what is buried below the fold, what appears only in the final paragraph.
- **Framing of numbers** — a percentage where an absolute would look small, or a baseline chosen to flatter.

Quote the specific words that carry the lean. An analysis that asserts bias without a quotable example is an opinion about the article, not an analysis of it.

## Political alignment

Where a piece has a discernible political alignment, name it and show why — the assumptions it treats as uncontroversial, whose interests it centres, which policy positions it presents as reasonable by default.

Be even-handed in how hard you look. Applying more scepticism to a piece you disagree with is itself the failure you are meant to be detecting.

A piece can be well-sourced and openly partisan; those are separate findings. Say both.

## What to return

Give the summary first, then the analysis, then a short verdict on how much weight a reader should put on it and why. Where the piece is straightforwardly good reporting, say that — manufacturing criticism to look rigorous is its own kind of bias.

Do not reproduce the article. Quote sparingly and attribute; the user wants your reading of it, not a copy.
