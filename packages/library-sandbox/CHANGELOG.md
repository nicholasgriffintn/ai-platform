# @ngriffin_uk/polychat-library-sandbox

## 0.2.0

### Minor Changes

- 4968623: Add the sandbox primitives. `library-sandbox` collects the mechanisms the API, sandbox Worker and computer Worker each carried: the dynamic Worker evaluation template and content-addressed code ids, outbound policy with a virtual tools origin, lease fences, HMAC-signed grants, execution control with pause and cancel, output redaction and request helpers. `ai-sandbox` composes them over Cloudflare's Worker Loader into `createEvaluator`, the loopback `OutboundGateway` entrypoint and `createCodeMode`. The API gains the `run_code` tool (backed by the `LOADER` binding) that runs model-written JavaScript in a fresh isolate and routes `tools.<name>(args)` calls back through the function registry. The computer Worker now fences leases and signs screen grants through the library and reports stale leases by code; the sandbox Worker uses the shared execution control, cancellation and redaction, and verifies JWTs with `@ngriffin_uk/auth-jwt` instead of a hand-rolled HS256 check.

### Patch Changes

- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [297b848]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [c126d04]
- Updated dependencies [b105d00]
- Updated dependencies [90f7110]
- Updated dependencies [67b52ed]
- Updated dependencies [6966643]
- Updated dependencies [1df361b]
- Updated dependencies [b105d00]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
  - @ngriffin_uk/polychat-utility-server@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-library-policy@0.2.0
