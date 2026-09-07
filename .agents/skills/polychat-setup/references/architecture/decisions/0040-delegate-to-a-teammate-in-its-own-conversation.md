# ADR 0040: Delegate to a teammate in its own conversation

Status: Accepted.

## Problem

Project flows remain the durable mechanism for ordered multi-agent work, but a conversation sometimes needs to ask one teammate to complete a bounded piece of work. The delegation must survive retries, compaction, queue redelivery and device changes without recreating the retired team-delegation runtime.

## Decision

Delegation creates an ordinary child conversation with a durable delegation record linking it to the parent conversation and run. The child executes as an ordinary chat run on the existing queue, under the existing conversation lock and in the existing run event journal. Its run carries a non-user trigger so its output can be attributed to the teammate and delegation rather than presented as the parent's ordinary assistant reply.

Version one allows one delegation depth and three concurrent children. Each delegation carries an explicit credit cap, step cap and deadline. The record is the authority for lifecycle and result projection; the child conversation remains the source of messages and the child run remains the source of execution state.

The delegate tool and queue path must use the same authorisation, tool intersection, usage admission, cancellation and recovery boundaries as ordinary runs. A delegate cannot create another delegate in version one. Project flows remain the right boundary for durable ordered sequencing; delegation is for bounded fan-out from an active conversation.

## Consequences

There is one runtime and one event protocol to operate, while parent and child histories remain separately addressable. Delegation adds a join record and lifecycle coordination, but avoids a second progress feed or a compatibility path for the retired runtime. Increasing depth or fan-out is a deliberate contract change with new security and recovery review.
