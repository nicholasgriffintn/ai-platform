# A selected model survives a page refresh

- **Change:** the composer no longer resets the persisted model to Default while the model catalogue or the sign-in state is still loading. The "is this model still selectable" rule moved into a shared `isModelReferenceSelectable` helper used by both model-selector fallbacks.
- **Surfaces:** web composer model selector.
- **Prerequisites:** none.
- **Risk if wrong:** every refresh silently drops the chosen model back to Default and clears reasoning, service tier and verbosity settings; or an unavailable selection still permits a request that cannot run.
- **Commits:** pending.

## Verify

- [x] Select a specific model in a conversation, refresh the page, and confirm the selector still shows that model, not Default.
- [x] Set a reasoning effort or verbosity alongside the model, refresh, and confirm those settings survive too.
- [x] Refresh while the real model-catalogue request is delayed and confirm the selector shows its loading state and then the chosen model, never Default in between.
- [x] Select Default deliberately, refresh, and confirm it stays Default.
- [x] As a pro account, select a pro-only model, refresh, and confirm it survives — this is the case where sign-in state resolves after the model list.
- [x] Sign out with a pro-only model selected and confirm the selection is retained, sending is blocked, and choosing an eligible replacement restores completion.

**Stop and report if:** the selection changes during refresh, or an unavailable model can still be sent.

## Automated evidence — 5 September 2026

Local Chromium E2E: `features/model-selection.spec.ts`, **3 passed**. The real completion request retains GPT-6 Astra, High reasoning, Caveman verbosity and Fast processing after reload; a deliberate Default selection survives reload and omits an explicit model from the next request. A CDP request hold delays the real `/models` response without replacing it, records every rendered selector state, and proves the sequence shows `Loading models...` then GPT-6 Astra without an Auto or Default fallback. After sign-out, the unavailable selection remains visible, Send is disabled, and an explicit eligible replacement completes successfully, matching [ADR 0011](../../skills/polychat-setup/references/architecture/decisions/0011-resolve-models-and-readiness-on-the-server.md).
