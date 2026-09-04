# A new conversation appears in the sidebar even when it is created before the list loads

- **Change:** `upsertConversationInChatCaches` wrote a newly created conversation into the sidebar's cached list pages, but did nothing when that list query had not resolved yet. The in-flight fetch then landed with the list as it was _before_ the conversation existed, and because the list carries a two-minute stale time, the sidebar kept saying "No conversations yet." long after the answer had finished. It now marks the remote list queries stale in that case, so they refetch and pick the conversation up.
- **Surfaces:** Web
- **Prerequisites:** none.
- **Risk if wrong:** the failure is a timing one and only shows on a slow first load, which is why it survived this long. Getting it wrong the other way means an extra list refetch per created conversation on a cold start — cheap, but worth confirming it is one refetch and not a loop.

## Verify

- [x] Sign in as a Pro account with no conversations, open Chat, and send a first message immediately — before the sidebar has finished loading. Expect the conversation in the sidebar within a second or two of the answer completing, not after a two-minute wait. _(Local release E2E: `Cold conversation history as pro`.)_
- [x] Repeat on a warm load, where the sidebar list is already showing conversations. Expect the new conversation at the top of the list exactly once, with no duplicate row. _(Local release E2E plus the existing warm-cache conversation journey.)_
- [x] With the network panel open, create a conversation on a warm load and confirm the sidebar list is not refetched — the cached list is updated in place, as before. _(Local release E2E observes zero list GETs while adding two more conversations.)_
- [ ] Create several conversations in quick succession on a cold load and confirm the list settles with all of them and no repeated refetching.

**Stop and report if:** the sidebar refetches its list on every message rather than only when the list had not loaded, or a conversation appears twice in the list.

## Notes

A regression test in `apps/app/src/lib/__test__/conversation-cache.test.ts` covers the unloaded-list case. The release suite journey "Chat as pro › renames, finds and removes a conversation" was failing intermittently on exactly this race, which is how it was found.
