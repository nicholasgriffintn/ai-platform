# A selected model survives a page refresh

- **Change:** the composer no longer resets the persisted model to Auto while the model catalogue or the sign-in state is still loading. The "is this model still selectable" rule moved into a shared `isModelReferenceSelectable` helper used by both model-selector fallbacks.
- **Surfaces:** web composer model selector.
- **Prerequisites:** none.
- **Risk if wrong:** every refresh silently drops the chosen model back to Auto and clears reasoning, service tier and verbosity settings; or a genuinely retired or pro-only model stays selected and every send fails.
- **Commits:** pending.

## Verify

- [ ] Select a specific model in a conversation, refresh the page, and confirm the selector still shows that model, not Auto.
- [ ] Set a reasoning effort or verbosity alongside the model, refresh, and confirm those settings survive too.
- [ ] Refresh on a slow connection (throttled network) and confirm the selector shows its loading state and then the chosen model, never Auto in between.
- [ ] Select Auto deliberately, refresh, and confirm it stays Auto.
- [ ] As a pro account, select a pro-only model, refresh, and confirm it survives — this is the case where sign-in state resolves after the model list.
- [ ] Sign out with a pro-only model selected and confirm the selector falls back to the default model rather than staying on one the account cannot use.

**Stop and report if:** the selection changes on refresh, or a model the account cannot use stays selected.
