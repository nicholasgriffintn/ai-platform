---
name: structured-reasoning
description: >-
  Work through a problem where the answer depends on reasoning the user needs to see and check — a diagnosis from ambiguous evidence, a decision between options with real trade-offs, an estimate built from assumptions, or a conclusion drawn across several tool results. Load when the user asks you to show your working, asks how you reached a conclusion, or the problem has no single retrievable answer.
metadata:
  polychat-display-name: Structured reasoning
  polychat-category: Reasoning
  polychat-tags: "analysis, decisions, diagnosis, estimation"
---

# Structured reasoning

This is for problems where the reasoning _is_ the deliverable. The user cannot check your answer unless they can see how you got there, and you cannot check it either.

Do not load this for questions with a retrievable answer. Narrating the steps of a lookup adds length and nothing else.

## Separate what you know from what you are assuming

This is the whole discipline. Most wrong answers come from an assumption that was never labelled as one.

Before reasoning, split the inputs three ways:

- **Established** — the user told you, a tool returned it, or it is not in dispute.
- **Assumed** — you are supplying it because the problem does not work without it. Say so, and say what you assumed.
- **Unknown** — it matters, you do not have it, and no assumption is safe. Name it.

An unknown that changes the answer is not a footnote. If the conclusion flips depending on something you do not know, that is the finding — state it before the conclusion, not after.

## Reasoning that is worth showing

Show the steps that carry weight and skip the ones that do not. A step earns its place when it eliminates a possibility, introduces a number, or commits to a judgement the user could disagree with.

- Work in the direction the evidence points, not the direction that confirms the first idea.
- When several explanations fit, say what would distinguish them. "It is probably X" is worth much less than "It is X or Y; checking Z tells you which."
- Carry uncertainty forward rather than rounding it away at the first step. An estimate built on three shaky inputs is shakier than any of them.
- When you use a tool result, say what you took from it. Tool output that silently becomes a conclusion is unauditable.
- Change your mind out loud when the evidence turns. A revised conclusion with the reason is more trustworthy than a clean one.

## Deciding between options

When the task is a choice, do not produce a balanced list and leave the user to decide. State what you would do.

- Name the criterion that actually decides it. Most option comparisons collapse to one factor once it is written down.
- Say what each option costs, not just what it offers.
- Give the recommendation, then the strongest argument against it. If you cannot state a real argument against, you have not understood the alternative.

## Finishing

End with the conclusion, stated plainly, and the confidence you have in it — grounded in something specific ("this holds unless the deployment is multi-region") rather than a bare percentage.

If the reasoning did not reach a conclusion, say that and say what would get you there. A named next check is a useful answer. A confident guess dressed as analysis is not.
