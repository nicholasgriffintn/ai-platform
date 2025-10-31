# Chat Completions

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

## Basic Usage

### Create a Chat Completion

```http
POST /v1/chat/completions
```

**Request:**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ]
}
```

**Response:**
```json
{
  "id": "cmpl_abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "claude-3-5-sonnet-20241022",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  }
}
```

### Streaming

Enable streaming to receive responses as Server-Sent Events:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [...],
  "stream": true
}
```

Response format:
```
data: {"id":"cmpl_abc123","object":"chat.completion.chunk","choices":[{"delta":{"content":"The"},"index":0}]}

data: {"id":"cmpl_abc123","object":"chat.completion.chunk","choices":[{"delta":{"content":" capital"},"index":0}]}

data: [DONE]
```

## Parameters

Based on the actual schema (`createChatCompletionsJsonSchema`):

| Parameter | Type | Description |
|-----------|------|-------------|
| `completion_id` | string | ID for storing/continuing conversations |
| `model` | string | Model identifier (optional with auto-routing) |
| `mode` | enum | `"normal"`, `"thinking"`, `"no_system"`, `"local"`, `"remote"`, `"agent"` |
| `should_think` | boolean | Enable thinking mode (Claude Sonnet 3.7) |
| `use_multi_model` | boolean | Generate with multiple models |
| `messages` | array | Conversation messages (required) |
| `temperature` | number | 0-2, default 0.8 |
| `top_p` | number | 0-1, default 0.9 |
| `top_k` | number | 1-100 |
| `n` | number | Number of completions (1-4, default 1) |
| `stream` | boolean | Enable SSE streaming |
| `stop` | string\|array | Stop sequences |
| `max_tokens` | number | Default 1024 |
| `presence_penalty` | number | -2 to 2, default 0 |
| `frequency_penalty` | number | -2 to 2, default 0 |
| `logit_bias` | object | Token likelihood modifications |
| `user` | string | User identifier for logging |
| `seed` | number | Random seed |
| `metadata` | object | Key-value pairs for tracking |
| `enabled_tools` | array | Tool names to enable |
| `tools` | array | Tool definitions |
| `tool_choice` | string\|object | `"none"`, `"auto"`, `"required"`, or specific tool |
| `parallel_tool_calls` | boolean | Enable parallel tool execution |
| `reasoning_effort` | enum | `"low"`, `"medium"`, `"high"` (default: "medium") |
| `store` | boolean | Save conversation (default: false) |
| `response_format` | object | JSON schema for structured output |
| `platform` | enum | `"web"`, `"mobile"`, `"api"`, `"obsidian"` |
| `budget_constraint` | number | Max cost for completion |
| `response_mode` | enum | `"normal"`, `"concise"`, `"explanatory"`, `"formal"` |
| `use_rag` | boolean | Enable RAG |
| `rag_options` | object | RAG configuration (topK, scoreThreshold, etc.) |
| `max_steps` | number | Max sequential LLM calls (for tool use) |

## Conversation Management

### List Conversations

```http
GET /v1/chat/completions
```

**Query Parameters:**
- `limit` - Results per page (default: 25)
- `page` - Page number (default: 1)
- `include_archived` - Include archived conversations (default: false)

**Response:**
```json
{
  "data": [
    {
      "id": "cmpl_abc123",
      "title": "Python Help",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:35:00Z",
      "model": "claude-3-5-sonnet-20241022",
      "is_archived": false,
      "user_id": "user_123",
      "share_id": null
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 25,
  "pages": 2
}
```

### Get Conversation

```http
GET /v1/chat/completions/{completion_id}
```

**Query Parameters:**
- `refresh_pending` - Refresh pending status (default: false)

**Response:**
```json
{
  "id": "cmpl_abc123",
  "title": "Python Help",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z",
  "model": "claude-3-5-sonnet-20241022",
  "is_archived": false,
  "user_id": "user_123",
  "share_id": null,
  "settings": {}
}
```

### Get Messages

```http
GET /v1/chat/completions/{completion_id}/messages
```

**Query Parameters:**
- `limit` - Number of messages (default: 50)
- `after` - Pagination cursor

**Response:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant",
      "content": "Hi! How can I help?"
    }
  ],
  "conversation_id": "cmpl_abc123"
}
```

### Get Single Message

```http
GET /v1/chat/completions/messages/{message_id}
```

**Response:**
```json
{
  "id": "msg_xyz789",
  "role": "assistant",
  "content": "Hi! How can I help?",
  "timestamp": 1705318200,
  "conversation_id": "cmpl_abc123"
}
```

### Update Conversation

```http
PUT /v1/chat/completions/{completion_id}
```

**Request:**
```json
{
  "title": "New Title",
  "archived": true
}
```

At least one field required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmpl_abc123",
    "title": "New Title",
    "is_archived": true,
    ...
  }
}
```

### Delete Conversation

```http
DELETE /v1/chat/completions/{completion_id}
```

**Response:**
```json
{
  "success": true
}
```

### Delete All Conversations

```http
DELETE /v1/chat/completions
```

Deletes all conversations for the current user.

## Advanced Features

### Generate Title

```http
POST /v1/chat/completions/{completion_id}/generate-title
```

Auto-generate a title based on conversation content.

**Request:**
```json
{
  "messages": [...],
  "store": true
}
```

Both fields are optional. If messages not provided, uses first 3 from conversation.

**Response:**
```json
{
  "success": true,
  "title": "Python List Comprehension Help"
}
```

### Token Counting

```http
POST /v1/chat/completions/count-tokens
```

Count tokens before making a request.

**Request:**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {"role": "user", "content": "Hello world"}
  ],
  "system_prompt": "You are helpful"
}
```

**Response:**
```json
{
  "inputTokens": 18,
  "model": "claude-3-5-sonnet-20241022"
}
```

### Guardrails Check

```http
POST /v1/chat/completions/{completion_id}/check
```

Run content safety checks on a conversation.

**Request:**
```json
{
  "role": "user"
}
```

**Response:**
```json
{
  "response": {
    "status": "safe",
    "flagged": false
  }
}
```

See [Guardrails](./guardrails.md) for details.

### Submit Feedback

```http
POST /v1/chat/completions/{completion_id}/feedback
```

Submit feedback on a completion.

**Request:**
```json
{
  "log_id": "log_abc123",
  "feedback": 1
}
```

**Response:**
```json
{
  "response": {
    "status": "success",
    "message": "Feedback submitted"
  }
}
```

## Sharing

### Share Conversation

```http
POST /v1/chat/completions/{completion_id}/share
```

Create a public share link.

**Response:**
```json
{
  "share_id": "abc123def456"
}
```

Access at: `https://polychat.app/s/abc123def456`

### Unshare Conversation

```http
DELETE /v1/chat/completions/{completion_id}/share
```

**Response:**
```json
{
  "success": true
}
```

### Access Shared Conversation

```http
GET /v1/chat/shared/{share_id}
```

No authentication required.

**Response:**
```json
{
  "messages": [...],
  "conversation": {
    "id": "cmpl_abc123",
    "title": "Example Chat",
    "created_at": "2024-01-15T10:30:00Z",
    "model": "claude-3-5-sonnet-20241022"
  },
  "share_id": "abc123def456"
}
```

## Tool Calling

Define tools the model can use:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City name"
            }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

The model will call tools when appropriate. Tool results are provided in subsequent messages with `role: "tool"`.

## Message Format

Messages support various content types:

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "What's in this image?"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/image.jpg",
        "detail": "high"
      }
    },
    {
      "type": "document_url",
      "document_url": {
        "url": "https://example.com/doc.pdf",
        "name": "Document.pdf"
      }
    },
    {
      "type": "markdown_document",
      "markdown_document": {
        "markdown": "# Document\n\nContent here"
      }
    },
    {
      "type": "input_audio",
      "input_audio": {
        "data": "base64_encoded_audio",
        "format": "wav"
      }
    }
  ]
}
```

## Examples

### Basic Chat

```bash
curl https://api.polychat.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ]
  }'
```

### Streaming Chat

```bash
curl https://api.polychat.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Write a poem"}],
    "stream": true
  }'
```

### Store and Continue Conversation

```bash
# First message
curl https://api.polychat.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello"}],
    "store": true
  }'
# Returns completion_id in response

# Continue conversation
curl https://api.polychat.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completion_id": "cmpl_abc123",
    "messages": [
      {"role": "user", "content": "Hello"},
      {"role": "assistant", "content": "Hi! How can I help?"},
      {"role": "user", "content": "Tell me a joke"}
    ]
  }'
```

## Related Features

- [Code Generation](./code-generation.md) - Specialized code endpoints
- [Agents](./agents.md) - Agents with custom tools
- [Models](./models.md) - Available models
- [Guardrails](./guardrails.md) - Content safety
- [Memories](./memories.md) - RAG and context (PRO only)
