import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const chatTagDescription = md`
# Chat Completions

An OpenAI-compatible port onto the platform. Point an unmodified OpenAI client at Polychat and it works; a client that knows Polychat can add platform parameters on the same body.

## Compatibility

~~~json
{
  "model": "gpt-5.6",
  "messages": [{ "role": "user", "content": "Hello, world!" }],
  "stream": true
}
~~~

A request with no \`conversation\`, \`agent\` or \`environment\` and no \`store: true\` runs the model directly and bills the caller. Streaming returns \`chat.completion.chunk\` events and ends with \`[DONE]\`.

## Polychat extensions

Add \`conversation\`, \`agent\`, \`environment\`, \`model_tier\`, \`permission_mode\`, \`compaction\`, \`budget\`, \`idempotency_key\` or \`response_id\`, or pass tools in the Polychat tool union, and the request runs as a Response. The result keeps the chat completion shape and carries the Response under \`response\`; the final stream chunk does the same.

Everything a Response can do is available directly at \`POST /responses\`.
`;
