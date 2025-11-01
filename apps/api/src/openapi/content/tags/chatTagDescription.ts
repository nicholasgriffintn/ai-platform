import { md } from "~/utils/markdown.js";

export const chatTagDescription = md`# Chat Completions

OpenAI-compatible chat API with support for streaming, tools, multi-turn conversations, and conversation management.

## Overview

The chat completions API provides:

- **OpenAI Compatibility** - Drop-in replacement for OpenAI's chat API
- **Streaming** - Real-time Server-Sent Events (SSE) responses
- **Tool Calling** - Function calling and tool use
- **Conversation Storage** - Save and retrieve conversations
- **Title Generation** - Auto-generate conversation titles
- **Sharing** - Public share links for conversations
- **Feedback** - Submit feedback on responses

## Basic Responses

By default, the chat completions endpoint returns the full response once processing is complete and uses the following format:

\`\`\`json
{
  "model": "gpt-4o-2024-08-06",
  "messages": [
    { "role": "user", "content": "Hello, world!" }
  ]
}
\`\`\`

## Streaming Responses

You can enable streaming to receive responses as Server-Sent Events:

\`\`\`json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [...],
  "stream": true
}
\`\`\`

Response format:
\`\`\`
data: {"id":"cmpl_abc123","object":"chat.completion.chunk","choices":[{"delta":{"content":"The"},"index":0}]}

data: {"id":"cmpl_abc123","object":"chat.completion.chunk","choices":[{"delta":{"content":" capital"},"index":0}]}

data: [DONE]
\`\`\``;
