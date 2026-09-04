# Preview, save, and restore tool output rewriting

- **Change:** Enable JSON whitespace compaction by default with preview and revision history in personal settings and project overview.
- **Surfaces:** API, web Chat and Work; iOS chat inherits server behaviour.
- **Prerequisites:** Deploy API and web together. No new migration or secret. The project-routing prerequisite is already merged.
- **Risk if wrong:** Changed tool meaning, incorrect policy scope, lost administrator edits, or rewritten stored history.
- **Commits:** `d07a38d95` (chat input policy PR).

## Verify

- [ ] In an account and project without saved policy, confirm Compact JSON whitespace is already selected and applied. Preview formatted JSON and confirm string whitespace remains intact while formatting whitespace disappears. Saving the preview alone must not change the policy.
- [ ] Save the policy, reload, and confirm the setting and revision remain. Trigger a plain JSON tool result and confirm the stored history retains its original content while provider-bound eligible content is compacted.
- [ ] Save Off, restore an earlier revision, then save. Confirm history advances and both enabling and disabling persist.
- [ ] In two tabs, load the same revision. Save in one, then save a different value in the other. Confirm the second save returns a conflict and Reload policy shows the first change.
- [ ] As a project owner/admin, save project policy. Run project chat as another member whose personal policy differs; confirm project policy wins. Confirm the member cannot save project policy, and a removed member cannot read or preview it.
- [ ] Preview malformed JSON and JSON containing escaped quotes, huge numbers, and duplicate keys. Confirm malformed content remains unchanged and valid content retains every value.

**Stop and report if:** policy crosses personal/project scope, a stale save succeeds, values change, stored history is rewritten, or members can edit project policy.
