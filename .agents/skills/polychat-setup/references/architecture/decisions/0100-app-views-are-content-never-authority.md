# ADR 0100: App views are content, never authority

Status: Implemented for MCP tools rendered in conversations, the Polychat MCP server and teammate A2A endpoints.

## Problem

MCP Apps let a tool ship its own interface: a `ui://` resource the host renders in a sandboxed frame, which can then call tools, open links and post messages back to the conversation. Polychat already renders artifacts in sandboxed frames, but an artifact is Polychat's own content. A tool's app is third-party code running next to the conversation, and the same JSON-RPC bridge that lets it refresh its data would, if trusted, let it send, spend or delete under the person's name without the approval rail ever seeing the call.

Polychat is also becoming a server. Claude, ChatGPT and Codex can call Polychat tools through `/mcp` with the person's API key, and a remote host has no way to show a Polychat approval card.

## Decision

An app view is rendered content. Its HTML runs in a frame with `allow-scripts allow-forms` and no same-origin access, under a content security policy built only from what the server declared for that resource, and every message it sends is a request that Polychat re-decides.

- A call from a view runs only if the integration marks the tool read-only; anything else is refused with a note to ask in the conversation, where the usual effect classes, autonomy dial and approvals apply.
- Links open in a new window, and a message from the view becomes a draft in the composer, never a sent turn.
- The resource is fetched and attached by the API when the tool result is produced, so the view never fetches it itself and the client never speaks to the integration directly.

The MCP server is a port onto the tool registry and Responses: it lists the tools the key owner can run in Polychat plus one tool per teammate, and runs them under the owner's authority with the `channel` trigger and assistant autonomy. A write without a standing approval or a never-standing effect is refused to the remote host and asks in Polychat instead of running because a remote host said so.

Agent2Agent follows the same rule. Each teammate publishes an agent card and a JSON-RPC endpoint to its owner's API key only. An A2A task is a Response in the teammate's own conversation, started as a `channel` run, so a message from another agent is never a grant of anything the teammate would otherwise ask for.

## Consequences

Any MCP server that follows the Apps extension renders in Polychat with no Polychat-specific work, and Polychat's own tools can gain views later without reopening the authority question. Views cannot drive writes, which rules out some interactions until an approval can be raised from a view, a later decision that would need to supersede this one. The server is stateless: it answers each POST as JSON, or as an event stream for clients that accept only that, and it sends no server-initiated messages.
