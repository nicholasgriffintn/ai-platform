# ADR 0029: Discover and activate tools within the current response

Status: Accepted.

Avoid stale client tool lists and loading every schema while keeping capability discovery separate from authority.

## Decision

Use one capability descriptor and launch contract across catalogues. `discover_capabilities` returns scope-aware readiness, reasons, stable setup references and canonical invocation tool names. Work discovery is bounded by project capabilities and the current runner's installations and connections.

Use `tool_selection_mode: managed` for ordinary web and iOS chat. The server adds discovery and skill loading, plus web search when signed in and permitted by the project. Keep `explicit` for caller-specified lists and saved agents that configure them; retain API defaults defined by the request contract. Hosted model tools remain separate user choices.

After discovery, activate only exact tool names marked eligible by the server for later steps of that response. Include eligible recipe/connector gateways and companion tools. Loading a skill can activate its declared tools; managed preparation defers suggested tools until needed. Reapply permissions, approvals and project bounds at execution. Never persist response activation or accept activation instructions from model prose.

Setup remains an explicit action through authenticated APIs. Render recipe and connector setup by resolving stable IDs against fresh catalogues; discovery never supplies trusted setup URLs, credentials or upstream sessions.

## Trade-off

An uncommon tool costs a discovery step. Tool relevance is model-selected, but account, mode, approval and project policy remain the hard boundaries. There is no per-turn function-tool picker to maintain.
