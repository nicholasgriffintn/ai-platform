# ADR 0040: Delegate to a teammate in its own conversation

Status: Accepted.

## Problem

Project flows remain the durable mechanism for ordered multi-agent work, but a conversation sometimes needs to ask one teammate to complete a bounded piece of work. The delegation must survive retries, compaction, queue redelivery and device changes without recreating the retired team-delegation runtime.

## Decision

Delegation creates an ordinary child conversation with a durable delegation record linking it to the parent conversation and run. The child executes as an ordinary chat run on the existing queue, under the existing conversation lock and in the existing run event journal. Its run carries a non-user trigger so its output can be attributed to the teammate and delegation rather than presented as the parent's ordinary assistant reply.

Version one allows one delegation depth and three concurrent children. Each delegation carries an explicit credit cap, step cap and deadline. The record is the authority for lifecycle and result projection; the child conversation remains the source of messages and the child run remains the source of execution state.

Settling a delegation always stores its summary, outputs, citations and outstanding questions before scheduling any optional parent continuation. Presentation reads that durable result directly, so a missing model budget can suppress the wake without hiding completed work. Follow-up work creates a fresh delegation and budget, names the predecessor, and explicitly either resumes the selected child conversation or starts a new one.

Conversation briefs and any additional memory bindings are explicit revisioned document references. A child run receives only the resolved bindings recorded on its delegation. It never gains ambient access to other personal or project memory.

Every invocation resolves through the same teammate execution boundary. A teammate context supplies its personal or project home conversation, exact connector account-and-operation grants, assigned routines and optional hosted computer. Colleague and bot remain behaviour choices; they do not grant or remove authority.

Hosted computer use is a separate graphical workload from the coding sandbox. It uses short-lived control leases with monotonically increasing fences, durable profile checkpoints and an explicit user-takeover state. Connector grants and computer leases are revalidated at each I/O boundary rather than trusted from the model prompt or an earlier run snapshot.

The delegate tool and queue path must use the same authorisation, tool intersection, usage admission, cancellation and recovery boundaries as ordinary runs. A delegate cannot create another delegate in version one. Project flows remain the right boundary for durable ordered sequencing; delegation is for bounded fan-out from an active conversation.

## Consequences

There is one run engine and one event protocol to operate, while parent, child and teammate-home histories remain separately addressable. Delegation adds join, grant and workload records, but avoids a second execution runtime or a compatibility path for the retired runtime. Increasing depth or fan-out, broadening connector grants, or allowing unattended graphical writes is a deliberate contract change with new security and recovery review.
