# Browse conversation branches

Open **Branches** above a saved remote conversation in Chat or Work. Select a related conversation to continue there, or close the popover to stay in the current branch. Titles and creation dates identify branches; archived branches remain visible and labelled.

The API is `GET /chat/completions/<conversationId>/branches`. Personal families include only the current user's personal conversations. Project families include only that same project's conversations after checking current workspace membership, even when different members created them. Shared-link access grants no access to this API.

The query walks ancestors and descendants with a cycle-safe, bounded recursive query. It returns at most 200 branches, preserves the current branch, removes parent identifiers outside the returned set, and reports truncation. Open another branch to explore from that point. This browser uses existing parent links; it does not copy or rewrite history, generate paid summaries, or alter compaction. Local-only conversations and native iOS navigation retain their current behaviour.
