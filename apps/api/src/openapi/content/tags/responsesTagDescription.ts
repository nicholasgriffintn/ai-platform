import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const responsesTagDescription = md`
# Responses

A Response is one execution: a Chat turn, a teammate turn, a Poly turn, a delegation, a project task stage or a channel reply. Every run anywhere in Polychat is a Response, and every surface reads it the same way.

## Create

~~~json
{
  "conversation": "conv_123",
  "input": "Summarise the attached report",
  "model": "gpt-5.6",
  "tools": [{ "type": "builtin", "id": "web_search" }],
  "stream": true
}
~~~

- \`conversation\` names or creates the container. Pass \`null\` for a response that is never stored.
- \`input\` is a string or a list of items (\`message\`, \`tool_output\`, \`interaction_response\`, \`approval_response\`).
- \`agent\` selects who runs it, for example \`{ "type": "teammate", "id": "..." }\`.
- \`environment\` selects where it runs: \`hosted\`, \`browser\`, \`device\`, \`machine\` or \`sandbox\`.
- \`tools\` is a typed union: \`function\`, \`builtin\`, \`managed\`, \`mcp\` and the hosted tools.
- \`idempotency_key\` makes a retried create return the accepted Response instead of starting another.

## Stream

With \`stream: true\` the body is a server-sent event stream. Every event carries \`type\`, \`sequence_number\` and \`response_id\`:

~~~
event: response.created
data: {"type":"response.created","sequence_number":0,"response_id":"run_1","response":{...}}

event: response.output_item.added
data: {"type":"response.output_item.added","sequence_number":4,"output_index":0,"item":{"type":"message","role":"assistant","id":"msg_1","content":[]}}

event: response.output_text.delta
data: {"type":"response.output_text.delta","sequence_number":5,"item_id":"msg_1","output_index":0,"delta":"Hello"}

event: response.completed
data: {"type":"response.completed","sequence_number":12,"response":{...}}

data: [DONE]
~~~

## Follow

- \`GET /responses/{id}\` returns the authoritative state and output items.
- \`GET /responses/{id}/events?after=N\` replays lifecycle events, or returns a snapshot when the cursor is too old.
- \`POST /responses/{id}/input\` answers a question, resolves an approval or steers. Set \`when: "after"\` to queue a message for when the response finishes.
- \`POST /responses/{id}/cancel\` cancels an exact attempt.
- \`GET /responses\` lists responses, and finds an accepted create by \`idempotency_key\`.

## Utilities

- \`POST /responses/input_tokens\` counts the tokens a model would read for an input and instructions.
- \`POST /responses/compact\` summarises a conversation's older items so the next response fits the context window.
`;
