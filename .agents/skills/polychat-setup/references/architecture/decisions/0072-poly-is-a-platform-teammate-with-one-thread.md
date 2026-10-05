# ADR 0072: Poly is a platform teammate with one thread per person

Status: Implemented for identity and the thread. Supersedes [0016](0016-meta-tools-belong-to-the-meta-scope.md).

## Problem

ADR 0016 made Poly a separate kind of conversation that could navigate the product but never act. That kept product-operating tools away from teammates and recipes, but it also meant Poly had no identity, grants, memory or routines of its own, and every overlay session could start a fresh conversation, so nothing Poly learned or was asked to follow survived the session. People expect the character that knows the product to be the same one that does the work, and to keep one conversation going rather than choosing which session to continue.

## Decision

Poly is the platform teammate `platform-poly`. Each person gets one personal teammate context for it, created the first time they open Poly, and that context's home conversation is their Poly thread. The thread has the conversation type `poly`, is created only by the context, and is excluded from conversation lists as before. `GET /poly/home` returns it; the overlay always opens it and offers no "new conversation".

Poly is defined in code beside the other platform teammates and synced into the teammates table, but it is not part of the roster: it never appears in teammate lists, project defaults or the hire catalogue. A run as Poly is admitted only in the requesting person's own active, personal Poly home conversation; delegations, project tasks, channels and other conversations cannot run it. A `poly` conversation in turn only runs as Poly, which the server checks from the admitted run configuration rather than from anything the client sends.

Navigation tools (find, open, organise, read, start, hire, list attention) are offered only on turns the person started in their Poly thread. A turn started by a schedule, delegation, channel or any other trigger never receives them, so a background wake cannot rearrange a workspace. Every navigation tool still re-authorises the record it touches, and navigation remains a tool result the client follows.

## Consequences

Poly gains the teammate machinery (exact connection grants, a private memory document, routines and an optional computer) without a second runtime, and later changes widen what it can do through its teammate grants rather than through a special conversation scope. The "new conversation" escape hatch is gone, so compaction and memory carry the thread instead. A person's earlier `meta` conversations are kept as stored `poly` conversations but are not their new thread, because the thread is created by the context. A client-supplied trigger can only remove navigation, never add it, because only `user` turns are offered it and server-started runs set their own trigger.
