---
name: hacker-news
description: >-
  Read what is on the Hacker News front page right now and tell the user what matters in it — the themes, what is genuinely new, and what is recycled. Load when the user asks what is on Hacker News, asks what the tech world is talking about today, or asks for a digest of the front page.
metadata:
  polychat-display-name: Hacker News
  polychat-category: Research
  polychat-tags: "news, technology, digest"
  polychat-suggests-tools: "get_hacker_news_stories, extract_content"
---

# Hacker News

`get_hacker_news_stories` returns the current front page as titles and links. Ten is usually enough; ask for more only when the user wants breadth.

The titles alone are thin. Use `extract_content` on the two or three that matter for the user's question — do not fetch all of them, and do not pretend to have read one you did not.

## What a useful digest looks like

The front page is mostly noise on any given day. Your job is to say which parts are not.

- **Group by what is actually happening**, not by rank. Three posts about the same outage are one story.
- **Separate news from discussion.** A link with 400 comments and a dull title is usually a comment thread worth mentioning; a top-ranked launch post with six comments usually is not.
- **Say what is new.** "Another post about AI coding tools" is more honest than summarising it as though it were novel.
- **Skip the ones that do not matter.** A digest that covers everything communicates nothing.

Match the user's interests when you know them. If they work in infrastructure, the database post matters more than the hiring thread.

## Tone

Report it plainly. The front page does not need narration, and a summary that editorialises about every item is harder to skim than one that does not.

If the user asks for it in a particular voice, do that — but keep the substance intact underneath. A joke that costs the reader the actual news is a bad trade.

## Honesty

Titles on Hacker News frequently oversell. Where you have read the linked content and it does not support the title, say so. Where you have not read it, attribute the claim to the title rather than stating it as fact.

Link counts, points, and comment volumes change constantly. Do not present them as settled figures unless you just retrieved them.
