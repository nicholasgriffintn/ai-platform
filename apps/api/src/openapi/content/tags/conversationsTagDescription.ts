import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const conversationsTagDescription = md`
# Conversations

A conversation is the container that Responses run in. It owns items, a title, organisation, sharing, a goal and delegations.

## Items

Items are the only content contract. A stored conversation is a list of items, a Response produces items, and the event stream adds items. Item types are \`message\`, \`tool_output\`, \`compaction\` and \`goal\`; stream-only items add \`tool_call\`.

~~~json
{
  "type": "message",
  "id": "msg_1",
  "role": "assistant",
  "content": [{ "type": "text", "text": "Hello" }],
  "parts": [{ "type": "text", "text": "Hello" }],
  "metadata": { "model": "gpt-5.6", "provider": "openai" }
}
~~~

## Routes

- \`GET /conversations\` lists conversations. \`GET /conversations/{id}\` returns one with its latest items and \`latest_response\`.
- \`GET /conversations/{id}/items\` pages through items. \`GET /conversations/items/{item_id}\` returns one item. \`GET /conversations/{id}/branches\` lists its branches.
- \`PATCH /conversations/{id}\` updates the title, archive state, permission mode, branch parent or items. \`POST /conversations/archive\` archives in bulk.
- \`POST /conversations/{id}/title\` generates a title. \`POST /conversations/{id}/share\` publishes a share link read at \`GET /conversations/shared/{token}\`.
- \`/goal\`, \`/delegations\`, \`/queue\`, \`/organisation\`, \`/feedback\`, \`/check\` and \`/artifact_bindings/read\` live under the conversation they belong to.
- \`/conversations/groups\` and \`/conversations/saved_items\` organise conversations across the account. \`/conversations/handles\` lists the agent handles granted to delegations.
`;
