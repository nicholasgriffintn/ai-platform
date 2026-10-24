# @ngriffin_uk/polychat-utility-server

## 0.3.0

### Minor Changes

- 80fee8e: MCP tools can now show their own interface in a conversation, and Polychat can be used as a tool from other assistants.

  - **Apps inside the chat.** When a connected MCP integration ships an interface for a tool (the MCP Apps extension), Polychat renders it in the reply in a sandboxed frame: pickers, tables, small dashboards. The app can refresh its own data through read-only tools; anything that would change something still goes through the conversation so it can ask you first.
  - **Polychat as an MCP server.** Point Claude, ChatGPT, Codex or any MCP client at the /mcp endpoint with a Polychat API key and it can run the same tools you can run in Polychat, and ask any of your teammates to take on a job. Anything that needs approval waits for you in Polychat.

### Patch Changes

- Updated dependencies [8b2929f]
- Updated dependencies [8b965f6]
- Updated dependencies [91c7d3d]
- Updated dependencies [7accf45]
- Updated dependencies [bf39c94]
- Updated dependencies [b3e3ea2]
- Updated dependencies [f4841cd]
- Updated dependencies [80fee8e]
- Updated dependencies [8b965f6]
- Updated dependencies [0a57f73]
- Updated dependencies [11381a9]
- Updated dependencies [91c7d3d]
- Updated dependencies [7b36da1]
- Updated dependencies [80fee8e]
- Updated dependencies [7a9f872]
- Updated dependencies [7accf45]
  - @ngriffin_uk/polychat-schemas@1.5.0
  - @ngriffin_uk/polychat-utility-core@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [82c133e]
- Updated dependencies [005b9f3]
- Updated dependencies [393652d]
- Updated dependencies [e820856]
- Updated dependencies [7bec25b]
- Updated dependencies [65fbf81]
- Updated dependencies [65fbf81]
- Updated dependencies [b97c227]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0
  - @ngriffin_uk/polychat-schemas@1.4.0

## 0.2.0

### Minor Changes

- ece96c4: Add the provider primitives package and move every provider implementation into it. `ProviderLibrary` owns categorised bootstrapping, alias and lifecycle resolution, per-category decorators, and host error mapping, and providers receive a `ProviderRuntime` (`ProviderHost` plus a resolver for sibling providers) instead of importing host modules. Platform credential detection, user-versus-platform API key resolution, and provider fallback move there from the API. `utility-server` holds the server helpers those providers share, and the API and sandbox Workers resolve providers through the library.
- d25fd94: Let people reach Polychat by email. A personal email binding is keyed by the address you write from, linked with the usual one-time command, and answered by threaded plain-text replies. Inbound mail arrives through the Worker email handler and is only accepted when a DKIM signature aligned with its From domain also covers the To or Cc header naming Polychat's inbox, so forged senders and replayed messages are refused. Auto-replies are ignored to avoid loops.

### Patch Changes

- 4968623: Add the sandbox primitives. `library-sandbox` collects the mechanisms the API, sandbox Worker and computer Worker each carried: the dynamic Worker evaluation template and content-addressed code ids, outbound policy with a virtual tools origin, lease fences, HMAC-signed grants, execution control with pause and cancel, output redaction and request helpers. `ai-sandbox` composes them over Cloudflare's Worker Loader into `createEvaluator`, the loopback `OutboundGateway` entrypoint and `createCodeMode`. The API gains the `run_code` tool (backed by the `LOADER` binding) that runs model-written JavaScript in a fresh isolate and routes `tools.<name>(args)` calls back through the function registry. The computer Worker now fences leases and signs screen grants through the library and reports stale leases by code; the sandbox Worker uses the shared execution control, cancellation and redaction, and verifies JWTs with `@ngriffin_uk/auth-jwt` instead of a hand-rolled HS256 check.
- 5ead2cc: Import GitHub and Linear issues into Work and review exact GitHub PR revisions manually or through signed automatic intake. Retain captured Sources and review Outputs, isolate each workspace and credential owner, and approve publication separately.

  Apply migration `0061_project_task_integrations` before deployment. Configure the GitHub webhook secret and pull-request events for automatic intake, and pull-request write permission for publication.

- b105d00: Verify every published upload file before inspection, including files without Hub hashes, and mark failed publications accurately. Respect pause and delete requests before provisioning, schedule resumed deployments, and calculate idle time from usage and resume events instead of background polling. Validate dataset byte ranges and restrict credentials during redirected downloads.

  Keep route revocations in force until explicit re-approval, record withdrawals for automatically allowed models, and retire affected routes during erasure without revoking the clean dataset revision.

- b105d00: Strip authentication headers when following a redirect to another origin. Preserve HEAD requests on 303 redirects and clear body headers when converting a request to GET.
- 57f8a16: Add Sites, a generative site builder that works from one brief. Jev classifies the brief into a plan (kind, scope, tone, palette, model tier), a tier-selected coding model streams the site as JSON Patch lines against a guardrailed component catalogue, and the shell renders every patch the moment it lands. `library-sites` holds the catalogue, patch stream compiler, validator and repair, prompt assembly, theme tokens and a deterministic Next.js and Tailwind code generator; `component-sites` holds the live React registry, themed preview and code view. Sites persist as revisioned outputs, refine in follow-ups, export as runnable project files, and hand off to a project's sandbox for a full build. The SSE buffer parser now lives once in `utility-core`. Sites are interactive (state, bindings, visibility, repeat, filters and actions in both the live renderer and the generated code), editable in place through an element inspector with zero-token edits and scoped refinement, exportable straight to a pull request with generated images, embeddable in chat through the `build_site` tool, revisioned with restore and public preview links, and judged by Jev at planning, refinement, quality-scoring and prompt-evaluation time.
- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [dd4389b]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
- Updated dependencies [b105d00]
- Updated dependencies [90f7110]
- Updated dependencies [b105d00]
- Updated dependencies [251ac59]
- Updated dependencies [41bb6a8]
- Updated dependencies [67b52ed]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [ee31a6d]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [169e2f5]
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [1df361b]
- Updated dependencies [6e76041]
- Updated dependencies [d3f1df3]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
