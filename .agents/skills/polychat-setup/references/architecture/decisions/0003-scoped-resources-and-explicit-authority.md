# ADR 0003: Use scoped resources and explicit authority

Status: Implemented.

## Problem

The same inputs, results and configuration were at risk of acquiring parallel stores and inconsistent access rules.

## Decision

Use **sources** for durable inputs, **outputs** for results, **templates** for reusable configuration, **activity** for execution history, and immutable **audit records** for governed workspace changes. A source or output is personal without a project and collaborative with one. Conversation links are provenance, not authority.

Media is source material, whoever made it. Uploaded images, audio and video, and the images, video, model runs, drawings and podcast episodes generated in Sources, are sources: a generated one carries its model, prompt and the sources it drew on in its `generation` metadata and stays `processing` until its file arrives. Transcripts, notes and cover art belong to the media source they describe, and a transcript becomes that source's searchable content. Generated media therefore feeds retrieval, podcasts and later conversations like anything else supplied. Outputs remain the results of a run, such as documents, decks and reports; tools that answer inside a conversation keep their own results there.

Podcast shows are source collections of kind `podcast`. A show's RSS feed is the only unauthenticated path to source bytes: it is addressed by a hashed token on the collection, serves only available audio sources in that show, and a new link revokes the old one.

Notebooks are conversation groups. The same collection that groups conversations also links the sources those conversations read, and outputs made for it carry its `collection_id`; deleting a notebook unlinks both without deleting either. A notebook narrows retrieval and never grants authority: a turn reads only the notebook's linked, available sources, each still authorised by its own personal or project scope, and a personal notebook holds only its owner's personal sources.

Keep file bytes private. Authorise source and output access on the server; output shares use hashed, expiring, revocable tokens. Do not publish project conversations through personal conversation sharing. Use the owning service's creator and administrator mutation rules rather than inferring write permission from read access.

Store validated settings in `capability_configuration`, keyed by scope, capability kind and ID. Configuration does not enable a capability. `project_capability` owns project associations; app and recipe associations are member-created and creator-managed, while project tools remain administrator-managed.

Keep recipe installations user-owned, including their project ID and creator. Members can see project installations; only their creator changes them. Scheduled execution retains user and project scope and resolves that person's current connections. Owners and administrators curate the reserved project context collection; the memory service owns memory retrieval and writes.

Validate project templates against current catalogues before atomic creation. Transfer workspace ownership atomically and require transfer before an owner leaves. Retain workspace audit history after deletion; record the deletion request before removing collaborative content and memberships.

## Consequences

Polymorphic scopes and separate D1 and R2 stores require explicit cleanup, and retained audit records may reference deleted workspaces. Provider connections remain personal; shared credentials must not emerge accidentally from project configuration.
