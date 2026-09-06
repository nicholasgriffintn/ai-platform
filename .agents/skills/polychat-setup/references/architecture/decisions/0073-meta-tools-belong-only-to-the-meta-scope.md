# ADR 0073: Meta tools belong only to the meta scope

Status: Accepted.

Polychat needed a home base that finds, opens, tidies and reads a person's conversations, projects and workspaces from anywhere in the product. Building it as a separate assistant would duplicate the turn engine; giving ordinary conversations product-operating tools would let any teammate or recipe rearrange a person's workspace.

## Decision

Poly is an ordinary conversation of type `meta` owned by the signed-in user. A request becomes meta when the client sends `meta_assistant` or when the stored conversation already has that type; the two must agree, and anonymous callers are refused. The client's `ui_context` (route, place, open conversation, workspace, project, task, run) is a hint the prompt can use to resolve phrases such as "this conversation"; every tool re-authorises the referenced record.

The meta scope receives only the meta tool group (`find_places`, `open_place`, `organise_conversation`, `read_conversation`) and no world-facing tools, skills, memory or project context; other scopes never receive meta tools. Each meta tool refuses execution unless the request's conversation type is meta, and it acts through the same services the web UI calls as that user. Navigation is a tool result the client follows; the server never redirects.

Meta conversations are excluded from personal conversation lists, global search and bulk archive. The web renders Poly through the shared `ConversationThread` inside a conversation scope, so the open page keeps its own conversation while the overlay runs another.

## Trade-off

Poly cannot approve tool requests, run connectors or act for other members, by design. A second persisted conversation per person exists outside the visible lists. Tool availability is decided per request from the conversation type, so a client cannot opt a normal chat into meta tools by naming them in `enabled_tools`.
