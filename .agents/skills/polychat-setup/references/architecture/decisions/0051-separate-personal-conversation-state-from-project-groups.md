# ADR 0051: Separate personal conversation state from project groups

Status: Accepted and implemented.

Conversation organisation must survive reloads and work across lists, search and Attention without changing project access or execution authority. Treating every field as shared would leak one member's reading workflow to others, while workspace-wide groups would create an unchosen taxonomy and a broader management boundary.

## Decision

Store pin, unread and snooze state per conversation and user. A time snooze remains active until its timestamp passes; a next-response snooze remains active until a later assistant message exists. Hide active snoozes from ordinary conversation lists and Attention, but retain them in authorised global search so a person can find and reverse the operation. Use a monotonically increasing revision and compare-and-set updates so stale clients receive a conflict instead of overwriting newer state.

Define groups with exactly one scope, and place each conversation in at most one group. Personal conversations use groups owned by the current user. Project conversations use shared project groups, not personal or workspace groups. Project owners and administrators create or delete the project's groups; any current project member who can access a conversation can move it between those groups or out of them. Group deletion removes its memberships, and normalised names are unique within their scope. Conversation lists show each group as its own section ahead of the date or type sections.

Authorise every organisation read or mutation through the conversation's current access path. Recheck project role for project-group management and match a group's scope to the conversation before moving it. Keep organisation metadata independent from membership, runner identity, connector credentials and approvals; none of these fields grants access or an execution action.

Expose the metadata through the existing chat API and include its list projection in personal conversations, project conversations and global search. Attention reads the current user's unread and snooze state while deriving operational status from its existing authoritative task and run sources. Presentation packages receive data and typed intents; web owns fetching, cache invalidation and layout. The conversation menu offers each intent as its own item with a single-key shortcut, loading the organisation record lazily when the menu first opens.

## Consequence

Two project members can organise the same shared conversation differently while seeing the same project groups. Project groups intentionally require a project management role to define but do not become workspace taxonomy. Single membership keeps "move to group" unambiguous and lets the sidebar render groups as sections without duplicating conversations. Expired or answered snoozes need no scheduler or cleanup job because their effective state is derived at read time; old rows may remain until a later update without affecting presentation.
