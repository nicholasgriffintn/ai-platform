# Polychat API

Use the [setup reference](../../.agents/skills/polychat-setup/SKILL.md) for local configuration and validation.

## Enterprise identity

Configure one OIDC connection per workspace in **People & access → Enterprise sign-in** as the workspace owner. Register a confidential client using HTTP Basic client authentication, the exact callback shown after saving, and S256 PKCE. Use RS256 or ES256 ID tokens with a verified email and a complete array of groups.

Map explicit groups to member or admin roles. Admin takes precedence when several groups match; group claims never grant workspace ownership or a platform role. Work access still requires each person's existing Pro entitlement.

Share the connection's sign-in link or connection ID. Web and desktop sign-in use the same verified identity flow; desktop returns through its existing one-use native exchange. Existing accounts must explicitly link from **Account → Company access** while signed in to that account in the browser. Matching email addresses never merge accounts.

Refresh managed access from **Account → Company access** even after the workspace disappears from the workspace list. A verified sign-in grants access until the earlier of the ID token expiry and 15 minutes. Missing, excessive or unmapped groups revoke managed membership; cached sync audiences do not retain earlier recipients.

Save with the current `expectedRevision` to rotate credentials or change mappings. Saving invalidates previous grants and in-flight sign-ins; disabling works even when discovery is unavailable. Disconnecting revokes managed access and retains inactive membership records. Manual members and the owner remain available, and converting a managed role to manual access requires confirmation.

Create, read, update and disconnect through `/workspaces/:workspaceId/identity` using POST, GET, PATCH and DELETE. Read the current user's linked connections through `GET /auth/enterprise/connections`. Configuration responses omit client secrets; encrypted credentials bind the connection, issuer, client ID and revision.

Apply migration `0059_enterprise_identity` before the new API. Its `active_workspace_member` view is the authority source for membership reads, conversation access, notifications and sync delivery; keep the view's connection revision, enabled state and lease predicates intact. Keep membership writes on the base table and recheck current actor authority atomically when granting manual access.

Group provisioning refreshes at sign-in. Removing someone only in Polychat does not remove their identity provider group: a later verified sign-in can grant access again. Remove the upstream group, disable the connection or disconnect it to prevent reprovisioning. Issuer and client ID are immutable; replace the connection when either changes.

## Channel bindings

Connect personal channels in **Account → Channels** and project channels in **Project settings**. Configure the deployment’s Slack or Telegram bot first. Slack bindings verify the workspace against `auth.test` and require the configured bot user ID; Telegram supports personal scope.

Choose an explicit list of allowed sender IDs. Those senders can start runs using the binding creator’s access in the chosen scope. Project membership and external sender identity do not inherit another person’s credentials.

Use **Mentions and active threads** for Slack. Mention the bot to start a thread, then send follow-ups in that thread; direct messages start a conversation without a mention. Each Slack root thread has a separate Polychat history and receives threaded replies.

Send `polychat stop`, `polychat mute`, or `polychat resume` inside the thread. Stop cancels the current run; mute also blocks subsequent replies until resume. A stopped response cannot reply after its thread revision changes, and retries of the original stop cannot cancel a newer run.

Create bindings with `POST /channels/bindings`; list them with `GET /channels/bindings`. Update sender permissions, reply mode and enabled state with `PATCH /channels/bindings/:bindingId` and the current `expectedRevision`. Disconnect with `DELETE /channels/bindings/:bindingId`. Configuration changes invalidate authority captured by earlier queued work.

```json
{
  "channel": "slack",
  "workspaceId": "T0123456",
  "externalId": "C0123456",
  "allowedSenderIds": ["U0123456"],
  "replyMode": "mentions",
  "interactionMode": "direct"
}
```

Apply migration `0060_channel_threads` before running the new API. It disables existing bindings; recreate them with explicit workspace and sender permissions. Old queued binding tasks without thread authority fail validation. No compatibility path infers access from the old channel-wide binding.

## Connected repository knowledge

Open **Sources → Connected knowledge** and select a repository from your existing GitHub App connection. Choose a branch and a documentation folder; leave the path empty for the root. Import Markdown, MDX, text, reStructuredText and AsciiDoc files up to 250 KB each. Symlinks, submodules, executable files and binary content stay outside the import.

Keep private repositories in personal scope. Project imports require a public repository because project conversations and saved tool results are visible to project members. Recheck public visibility, current workspace membership and the current file SHA before returning a project document; recheck the owner's own GitHub connection for personal documents. A private repository never borrows another user's connection.

Search from the source library or use the existing `search_documents` tool in a conversation. Connected knowledge uses bounded phrase matching and preserves commit-pinned source citations; personal uploaded documents retain their existing vector retrieval. Project document search uses its project knowledge and never queries the caller's personal index.

Refresh every 15 minutes through the existing task scheduler. Walk non-recursive Git trees with a durable checkpoint, at most ten nodes per delivery and 10,000 queued/visited nodes per connection. Reject truncated trees rather than interpreting them as complete. Keep source IDs stable when content changes, and delete missing documents only after a complete scan.

Pause to hide imported material and stop new work. Resume to restart a snapshot; disconnect to remove imported sources and their collection references. Configuration revisions, expiring worker leases and atomic membership predicates prevent an earlier worker from writing after pause, disconnection or loss of project management access. Revoked GitHub access blocks retrieval before the next background sync.

Create and list imports with POST and GET `/sources/knowledge`; control them with PATCH `/sources/knowledge/:syncId` using the current `revision` and `sync`, `pause` or `resume`. Disconnect with DELETE and search with POST `/sources/knowledge/search`.

```json
{
  "repository": "company/handbook",
  "installationId": 12345,
  "branch": "main",
  "path": "docs"
}
```

Apply migration `0061_repository_knowledge` before the API. The delete trigger removes sources before their sync records cascade, including workspace/project deletion. Collector HTTP reads have fixed GitHub origins, bounded bodies, a ten-second deadline and read-only repository tokens. Upstream outages or rate limits hide unverified content; restore access and resume a blocked import.

Use the deployment's default GitHub App only for personal installations owned by the signed-in account's linked GitHub identity. Verify installation ownership before saving and whenever using stored deployment credentials. Organisation installations require caller-supplied App credentials until an organisation-authorised OAuth flow is available; installation IDs alone do not authorise deployment credentials.

Reconnect existing GitHub installations after upgrading. Sealed connection records now require an explicit credential source; untagged records are unavailable. Changing the deployment's App ID never bypasses ownership checks for previously saved deployment credentials.

Previously returned passages can remain in conversation history. Disconnection and repository changes prevent new retrieval; they do not erase material that was already public or deliberately shared.
