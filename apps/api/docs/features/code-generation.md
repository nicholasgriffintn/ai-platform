# Code Generation

Specialized endpoints for code completion, editing, and application using models optimized for coding tasks.

## Overview

The code generation features include:

- **Fill-in-the-Middle (FIM)** - Code completion at cursor position
- **Next Edit** - Suggest the next code change (Mercury model)
- **Apply** - Apply code snippets to existing files (Mercury model)

## Fill-in-the-Middle (FIM)

Complete code at a specific position using context before and after the cursor.

### Endpoint

```http
POST /v1/chat/fim/completions
```

### Use Cases

- IDE autocomplete
- Code suggestion at cursor
- Context-aware code generation
- Inline code completion

### Request Format

```json
{
  "model": "mistral-codestral-latest",
  "prompt": "def calculate_fibonacci(",
  "suffix": "\n    return result",
  "max_tokens": 100,
  "temperature": 0.7,
  "stop": ["\n\n"]
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Code before cursor |
| `model` | string | No | FIM-capable model |
| `suffix` | string | No | Code after cursor |
| `max_tokens` | number | No | Maximum tokens to generate |
| `min_tokens` | number | No | Minimum tokens to generate |
| `temperature` | number | No | Sampling temperature 0-2 |
| `top_p` | number | No | Nucleus sampling 0-1 |
| `stream` | boolean | No | Enable streaming |
| `stop` | array | No | Stop sequences |

### Response

**Non-streaming:**
```json
{
  "id": "fim_abc123",
  "object": "text_completion",
  "created": 1677652288,
  "model": "mistral-codestral-latest",
  "choices": [
    {
      "text": "n):\n    if n <= 1:\n        return n\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b",
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 45,
    "total_tokens": 70
  }
}
```

**Streaming:**
Server-Sent Events with text deltas:
```
data: {"id":"fim_abc123","choices":[{"text":"n):","index":0}]}

data: {"id":"fim_abc123","choices":[{"text":"\n    if","index":0}]}

data: [DONE]
```

### Supported Models

Models with FIM support (check via Models API):
- `mistral-codestral-latest` (Mistral)
- `mistral-codestral-mamba-latest` (Mistral)
- `mercury-coder` (Mercury)
- Other code-specialized models

## Next Edit

Get suggestions for the next code edit based on the current file and instruction.

### Endpoint

```http
POST /v1/chat/edit/completions
```

### Use Cases

- Code refactoring suggestions
- Implementation of features
- Bug fix suggestions
- Code improvement recommendations

### Request Format

Uses message format with special tokens:

```json
{
  "model": "mercury-coder",
  "messages": [
    {
      "role": "user",
      "content": "<|fim_prefix|>function validateEmail(email) {\n  // TODO: implement validation\n}<|fim_suffix|>\n\n<|fim_instruction|>Add email validation using regex<|fim_instruction|>"
    }
  ],
  "stream": true
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messages` | array | Yes | Message array with special tokens |
| `model` | string | No | Model (mercury-coder recommended) |
| `stream` | boolean | No | Enable streaming |

**Special Tokens:**
- `<|fim_prefix|>` - Code before the edit point
- `<|fim_suffix|>` - Code after the edit point
- `<|fim_instruction|>` - What to do

### Response

Returns chat completion format:

```json
{
  "id": "edit_abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "mercury-coder",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n  return emailRegex.test(email);"
      },
      "finish_reason": "stop"
    }
  ]
}
```

### Supported Models

Optimized for:
- `mercury-coder` (Mercury)

## Apply

Apply code snippets or patches to existing code.

### Endpoint

```http
POST /v1/chat/apply/completions
```

### Use Cases

- Apply suggested changes
- Merge code snippets
- Apply diffs/patches
- Code transformation

### Request Format

Uses message format with special tokens:

```json
{
  "model": "mercury-coder",
  "messages": [
    {
      "role": "user",
      "content": "<|fim_prefix|>Original code here<|fim_suffix|>\n\n<|fim_middle|>New code to apply<|fim_middle|>"
    }
  ]
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messages` | array | Yes | Message array with special tokens |
| `model` | string | No | Model (mercury-coder recommended) |
| `stream` | boolean | No | Enable streaming |

**Special Tokens:**
- `<|fim_prefix|>` - Original code context before
- `<|fim_suffix|>` - Original code context after
- `<|fim_middle|>` - New code to apply

### Response

Returns chat completion format with merged code:

```json
{
  "id": "apply_abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "mercury-coder",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Complete code with snippet applied"
      },
      "finish_reason": "stop"
    }
  ]
}
```

## Best Practices

### FIM Completions

1. **Provide sufficient context** - Include relevant code before and after the cursor
2. **Use stop sequences** - Prevent over-generation with appropriate stop tokens
3. **Adjust temperature** - Lower (0.2-0.4) for deterministic completions, higher for creative suggestions
4. **Limit max_tokens** - Set reasonable limits to avoid long completions

### Edit/Apply

1. **Clear instructions** - Be specific about what changes to make
2. **Sufficient context** - Include enough surrounding code for understanding
3. **Use appropriate model** - Mercury-coder is optimized for these tasks
4. **Stream responses** - Get faster feedback with streaming

## Integration Examples

### IDE Autocomplete

```javascript
async function getCompletion(beforeCursor, afterCursor) {
  const response = await fetch('https://api.polychat.app/v1/chat/fim/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: JSON.stringify({
      model: 'mistral-codestral-latest',
      prompt: beforeCursor,
      suffix: afterCursor,
      max_tokens: 50,
      temperature: 0.3,
      stream: false
    })
  });

  const data = await response.json();
  return data.choices[0].text;
}
```

### Code Refactoring

```javascript
async function suggestRefactoring(code, instruction) {
  const prompt = `<|fim_prefix|>${code}<|fim_suffix|>\n\n<|fim_instruction|>${instruction}<|fim_instruction|>`;

  const response = await fetch('https://api.polychat.app/v1/chat/edit/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: JSON.stringify({
      model: 'mercury-coder',
      messages: [{ role: 'user', content: prompt }],
      stream: true
    })
  });

  // Handle streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      if (line === 'data: [DONE]') break;
      const json = JSON.parse(line.slice(6));
      console.log(json.choices[0].delta?.content || '');
    }
  }
}
```

## Examples

### FIM Completion

```bash
curl https://api.polychat.app/v1/chat/fim/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral-codestral-latest",
    "prompt": "function calculateSum(arr) {",
    "suffix": "}",
    "max_tokens": 100,
    "temperature": 0.3
  }'
```

### Next Edit

```bash
curl https://api.polychat.app/v1/chat/edit/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type": application/json" \
  -d '{
    "model": "mercury-coder",
    "messages": [
      {
        "role": "user",
        "content": "<|fim_prefix|>const data = [];<|fim_suffix|>\n\n<|fim_instruction|>Add error handling<|fim_instruction|>"
      }
    ]
  }'
```

### Apply Edit

```bash
curl https://api.polychat.app/v1/chat/apply/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type": application/json" \
  -d '{
    "model": "mercury-coder",
    "messages": [
      {
        "role": "user",
        "content": "<|fim_prefix|>function old() {<|fim_suffix|>}<|fim_middle|>  return new implementation;<|fim_middle|>"
      }
    ]
  }'
```

## Related Features

- [Chat Completions](./chat-completions.md) - General conversational AI
- [Models](./models.md) - Discover code-capable models
- [Agents](./agents.md) - Create coding agents with custom tools

## Further Reading

- [FIM Documentation](../chat/fim.md) - Detailed FIM implementation
- [Next Edit and Apply Documentation](../chat/next-edit-and-apply.md) - Mercury edit capabilities
