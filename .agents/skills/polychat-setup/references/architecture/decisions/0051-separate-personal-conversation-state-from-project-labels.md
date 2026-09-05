# ADR 0051: Separate personal conversation state from project labels

Status: Accepted and implemented.

Conversation organisation must survive reloads and work across lists, search and Attention without changing project access or execution authority. Treating every field as shared would leak one member's reading workflow to others, while workspace-wide labels would create an unchosen taxonomy and a broader management boundary.

## Decision

Store pin, unread and snooze state per conversation and user. A time snooze remains active until its timestamp passes; a next-response snooze remains active until a later assistant message exists. Hide active snoozes from ordinary conversation lists and Attention, but retain them in authorised global search so a person can find and reverse the operation. Use a monotonically increasing revision and compare-and-set updates so stale clients receive a conflict instead of overwriting newer state.

Define labels with exactly one scope. Personal conversations use labels owned by the current user. Project conversations use shared project labels, not personal or workspace labels. Project owners and administrators create or delete the project's labels; any current project member who can access a conversation can assign or remove those labels. Label deletion cascades assignments, and normalised names are unique within their scope.

Authorise every organisation read or mutation through the conversation's current access path. Recheck project role for project-label management and match a label's scope to the conversation before assignment. Keep organisation metadata independent from membership, runner identity, connector credentials and approvals; none of these fields grants access or an execution action.

Expose the metadata through the existing chat API and include its list projection in personal conversations, project conversations and global search. Attention reads the current user's unread and snooze state while deriving operational status from its existing authoritative task and run sources. Presentation packages receive data and typed intents; web owns fetching, cache invalidation and layout.

## Consequence

Two project members can organise the same shared conversation differently while seeing the same project labels. Project labels intentionally require a project management role to define but do not become workspace taxonomy. Expired or answered snoozes need no scheduler or cleanup job because their effective state is derived at read time; old rows may remain until a later update without affecting presentation.
