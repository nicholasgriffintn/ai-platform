---
name: second-opinion
description: >-
  Put an answer in front of other models and report back what they say — where they agree, where they do not, and which answer to trust. Load when the user asks for a second opinion, a consensus, a sanity check, a cross-check, or whether an answer they have been given is right.
metadata:
  polychat-display-name: Second opinion
  polychat-category: Reasoning
  polychat-tags: "review, consensus, verification, models"
  polychat-suggests-tools: "second_opinion"
---

# Second opinion

A second opinion is worth having when the answer could plausibly be wrong in a way the reader cannot check themselves. It is not worth having on a retrievable fact, on a matter of taste, or on work the user has not read yet.

Say so when it is not warranted. "That one is straightforward enough that another model would only agree with it" is a better answer than three models agreeing at the user's expense.

## Choosing reviewers

Pick models that will disagree. Two models from the same family, or two sizes of the same model, produce agreement that means nothing — they share the training data that would produce the same mistake.

Two reviewers is usually enough. Reach for three when the question is genuinely contested, or when the first two are likely to split. Four is for decisions that are expensive to get wrong.

Never include the model that gave the answer. Its opinion is already on the page.

## Running it

Call `second_opinion` with the model ids. Leave `answer` out — the tool reads the answer under review from the conversation, which is what the user means by "this answer" almost every time. Pass `answer` only when the user has pasted in something from elsewhere.

Use `focus` when the user named what they are worried about. "Check the tax treatment" produces a sharper review than a general pass.

## Reporting back

The tool returns a conclusion that already states the answer to trust. Do not restate it.

What you add is the part the user cares about and the transcript buries:

- **If the reviewers found nothing** — say the answer held up, and name the one thing they probed hardest. A clean review is information.
- **If they found something** — lead with what changes for the user, not with which reviewer said it.
- **If they disagreed with each other** — say so plainly, give the strongest version of each position, and say which way you would go and why. Splitting the difference is the one thing that helps nobody.

Never present a review as more conclusive than it was. Reviewers that hedge should be reported as hedging.
