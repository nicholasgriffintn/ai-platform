# ADR 0099: Reactions annotate and never authorise

Status: Implemented for conversation items, teammate runs and Slack and Telegram signals.

## Problem

People and teammates now react to messages: a 👍 on a draft, a 👀 when a teammate picks something up, a ⚠️ in Slack when a run fails. A reaction is cheap to give and easy to give by accident, and in chat apps it often reads as "yes". If any part of Polychat treated a 👍 as consent, a stray tap or a reaction relayed from a shared channel could send, spend or schedule something nobody approved. Grok Bot's documentation draws the same line for the same reason.

## Decision

A reaction is an annotation on one item. It is stored with the item, carries who reacted and when, and can be read back as feedback.

- A reaction never approves, confirms, sends, schedules, spends or starts a run, on any surface or channel. Exact approvals stay the only consent.
- A teammate sees the person's recent reactions as feedback in its next turn's context. The prompt says plainly that a reaction is not an instruction or an approval.
- Teammates react through the `react` tool, whose effect class is `draft`. A channel shows acknowledgement, failure and, if the binding asks for it, completion as reactions. Those reactions report what happened and never stand in for a reply.
- 👍 and 👎 also record the feedback signal that thumbs used to send, so feedback and reactions are one system.

## Consequences

Approval flows never need to inspect reactions, so new reaction sources (channels, iOS, desktop) can be added without an authority review. A future "react to approve" shortcut would need to supersede this ADR rather than slip in as a feature. Reactions add a write on the item row, so heavy reacting on a busy item publishes a message change each time.
