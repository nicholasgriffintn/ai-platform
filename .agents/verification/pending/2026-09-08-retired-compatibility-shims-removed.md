# Retired compatibility shims removed

- **Change:** Back-compatibility paths kept for URLs, browser storage and wire fields that no current client emits are gone. Removed: the `?completion_id=` conversation query fallback, the `?recipe_context=` launch parameter, the retired `/profile?tab=` redirects, the pre-registry `theme` localStorage key migration, the sweep of the `api_key` and `encrypted_api_key` storage keys, the `polychat:composer-banner:provider-setup:dismissed` onboarding suppression, the `use_rag` and `rag_options` request fields, the unread OpenAI `functions` and `function_call` request fields, the free-text council prompt parser, the `/chat/capabilities` and `/chat/experiences` 404 routes, the stale `REALTIME_LIVE_PROVIDER_MANIFEST` duplicate, the iOS `featured`/`supportsFunctions`/`isDeprecated` decoding aliases, the four zustand persist migrations behind the chat store, the `legacy` provenance origin and completeness, the `coding_should_commit` fallback for projects, and the retired-permission checkbox in the flow editor. Outdated persisted state and unreadable stored records now fall back to defaults instead of being reshaped.
- **Surfaces:** Web app, desktop, iOS, API.
- **Prerequisites:** None. No migration.
- **Risk if wrong:** A live path was removed with the shims — a current client field silently ignored, a signed-in session dropped, or a stored delivery policy read as the wrong default.
- **Commits:** This branch.

## Verify

- [ ] Open a chat and a project conversation from the sidebar and confirm the URL still carries the conversation in the path and reopens correctly after a reload.
- [x] Open `/profile` and switch through every tab, confirming each resolves and none 404s.
- [ ] Switch theme, reload, and confirm the choice survives. Confirm a browser with no stored theme gets the system default rather than a flash.
- [ ] Sign in on a browser that has used Polychat before and confirm the session still works without re-authenticating manually.
- [ ] Send a chat message from the iOS app and confirm the model list still shows featured and deprecated models correctly.
- [ ] Open a council conversation created before structured tool resolutions and confirm the picker still renders, even if it no longer shows as resolved.
- [ ] Open `/chat/capabilities` and confirm it opens the chat home rather than a 404 page.
- [ ] With chat settings customised (model, tier, temperature, compute site), reload and confirm they survive.
- [x] Open an output revision created before provenance was captured and confirm it reads as an unknown, partial record rather than erroring.
- [ ] Open a project with a coding environment configured and confirm its delivery policy still reads correctly, and that a sandbox run delivers the same way as before.

**Stop and report if:** any signed-in surface asks for credentials again after the change, or a conversation opened from an existing link lands on an empty chat.

## Boundary and source validation — 8 September 2026

- All 2,082 API tests passed across 288 files (`/tmp/polychat-api-verification-batch.log`). output.test.ts verifies absent/unparseable old provenance becomes unknown and partial with no invented run/model. Revision formatting uses that parser and the shared output detail handles missing model data.

- Reconciled the profile check with the previously passing Free/Pro profile journeys, which iterate every current configuration tab. Reviewed `ProfilePage`: current tabs still use the supported query selector; the removed compatibility redirects are separate retired destinations.
