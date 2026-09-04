# Preview and manage chat input rewriting

Verbose JSON tool results use context without adding information. Use **Tool output rewriting** in personal Profile customisation or a Work project overview to remove JSON whitespace before the shared chat turn sends eligible results to a provider.

Keep the default **Off**, or select **Compact JSON whitespace**, preview an example, and save. Project owners and admins manage project policy; members can read it and preview the saved setting. Project chat uses current project policy independently of the runner’s personal setting.

## Preserve meaning and history

Compact only successful, completed, or legacy tool messages whose content is a plain string containing a valid JSON object or array. Preserve numeric spellings, duplicate keys, string contents, escapes, tool-call identifiers, and the stored transcript. When execution mirrors the same string into text and tool-result parts, compact those copies together; leave any different or additional payload untouched. Leave ordinary text, malformed JSON, results above one million characters, pending approval, mixed-media or signed parts, and all user/system/assistant messages unchanged.

The preview uses the same transform without saving or calling a provider. Character counts are exact; token savings use the existing character-based estimate and are not a billing guarantee. Execution logs record the policy revision, rule, and number of changed messages without recording their contents.

## Save and restore safely

Each save includes the revision you read. A concurrent edit returns 409; reload the policy before trying again. Revision history retains the last 20 saves with actor and timestamp. Select **Restore** to review an earlier value, then **Save policy** to create a new revision. Select **Off** and save to disable rewriting.

Use these authenticated routes:

- `GET /user/chat-input-policy` or `/projects/:projectId/chat-input-policy` to read policy and history.
- `PUT` to either route with `{"expectedRevision":0,"policy":{"toolOutputRewriting":"compact_json"}}` to save.
- `POST` to either route plus `/preview` with `{"policy":{"toolOutputRewriting":"compact_json"},"content":"{ \"ok\": true }"}` to preview.

The existing scope configuration table stores policy and its bounded revision history atomically. Missing policy means Off; malformed stored policy fails closed. This is a settings history, not an immutable or indefinitely retained audit ledger. No new migration, secret, provider permission, or dependency is required.

## Surface coverage

The API applies the current policy on each shared chat provider call, including streamed and buffered turns, model ensembles, and council calls that use that boundary. Web Chat and Work expose controls. iOS chat calls using the same API receive the policy automatically; native settings controls are not included. Local-only browser conversations, independent capability provider calls, remote sandbox execution, and training are outside this chat-transform boundary.

Project templates do not copy this separate policy; a new project starts with rewriting Off. Provider execution governance in ADR 0040 remains a separate concern: rewriting does not enforce provider allowlists, residency, retention, or provider storage rules.
