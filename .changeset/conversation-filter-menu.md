---
"@ngriffin_uk/polychat-component-navigation": minor
"@ngriffin_uk/polychat-component-ui": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-schemas": minor
---

Replace the conversation list's stacked selects with a nested options menu, and extend what it can filter.

`component-ui` gains `OptionsMenu`, a submenu-per-setting menu whose rows carry their current value and check the selected option. `ConversationListControls` now takes a single `filters` object plus `onFiltersChange` and `onReset` instead of one prop pair per setting, and adds a last-activity window and a grouping choice alongside status and sort. `ConversationGroup` requires an `id` and treats `title` as optional so an ungrouped list renders without headings.

`schemas` publishes `conversationArchiveFilterSchema`, `conversationSortBySchema`, and `conversationActivityWindowSchema` so the API and its clients agree on the query parameters. `filterConversationsByListOptions` honours the activity window and the new title sort, and accepts an explicit `now` for testing.
