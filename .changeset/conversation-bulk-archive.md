---
"@ngriffin_uk/polychat-component-navigation": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-schemas": minor
---

Add a conversation list actions menu that archives or restores everything matching the current filters.

`component-navigation` gains `ConversationListActions`, a kebab menu that sits beside the filter control. It offers "Archive all (N)" on an active list and "Restore all (N)" on an archived one, and withholds the action under the mixed `all` status where the count would not describe what changes.

`schemas` publishes `bulkArchiveChatCompletionsJsonSchema` for the new `PATCH /chat/completions` endpoint, which matches on the same title and activity filters as the list and only moves conversations that are not already in the requested state. `ConversationListPage` now carries `total`, so a count can describe the whole filtered set rather than the loaded page.

`compareConversationsBySort` is exported so clients can order a list the same way the API does, rather than re-sorting by date and dropping the title sort.
