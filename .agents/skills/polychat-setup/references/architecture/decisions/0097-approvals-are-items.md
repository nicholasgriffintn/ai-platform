# ADR 0097: Approvals are items and standing approvals are a resource

Status: Accepted. Approval and interaction answers travel as response input items; the standing approvals resource is not yet implemented.

## Problem

A pending human decision had six representations: `connector_approval_id` on the next completion, `options.toolInteraction`, a teammate interaction resume, project task `tool-approval` and `answers` routes, computer-use session approvals, and Poly standing approvals. Each had its own client code and its own way of finding the run it belonged to.

## Decision

Answers are input. A response that is waiting is continued with `POST /responses/:id/input`, or with `POST /responses` naming `response_id`, carrying `approval_response` items for connector approvals and `interaction_response` items for tool questions, selections and takeovers. A `message` item with `when: "after"` queues a follow-up for when the response finishes. The engine's existing resume paths handle each item; the client no longer knows which path is which.

Standing approvals, teammate autonomy, project delivery intent and Poly's "always allow here" become one resource under `/approvals/standing` read by one policy, following [ADR 0071](0071-tools-declare-what-they-change.md) and [ADR 0086](0086-earn-standing-approvals-and-brake-when-the-owner-is-away.md). The attention inbox will list pending `approval_request` items rather than reconstructing them per surface.

## Consequences

One client path answers every kind of wait. Project task answer routes and computer approvals remain as separate doors until the standing approvals resource lands and are listed in the route-trimming plan.
