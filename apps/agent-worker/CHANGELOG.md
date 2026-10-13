# @assistant/agent-worker

## 0.1.0

### Minor Changes

- 6967a07: Host agent harnesses on Polychat's own ports. The agent worker now runs the Pi and OpenCode harnesses and a Hermes container behind one RPC contract, with models served by the API's OpenAI-compatible `/agents/model` port, workspace tools gated by the permission mode, and every reply streamed into chat as it is generated. OpenAI Agents joins as a remote harness through the same `agent-harness` chat provider. The sandbox worker moves to Sandbox SDK 1.0 with app-owned `Workspace` and `Computer` classes, absorbs the computer worker, and keeps caches and browser profiles with `DirectoryBackup`.

### Patch Changes

- Updated dependencies [6967a07]
  - @ngriffin_uk/polychat-schemas@1.3.0
  - @ngriffin_uk/polychat-library-sandbox@0.3.0
  - @ngriffin_uk/polychat-utility-core@0.3.1

## 0.0.2

### Patch Changes

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
  - @ngriffin_uk/polychat-library-sandbox@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
