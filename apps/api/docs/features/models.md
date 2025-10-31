# Models & Capabilities

Discover and filter AI models based on their capabilities, pricing, and features.

## Overview

The API provides access to 40+ AI models from multiple providers including:

- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)
- Mistral
- DeepSeek
- Meta (Llama)
- And many more

Each model has different capabilities, pricing, and performance characteristics.

## Endpoints

### List All Models

```http
GET /v1/models
```

Returns all available models with their metadata.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-3-5-sonnet-20241022",
      "object": "model",
      "created": 1677649963,
      "owned_by": "anthropic",
      "capabilities": ["chat", "vision", "function_calling", "streaming"],
      "context_window": 200000,
      "pricing": {
        "input": 0.003,
        "output": 0.015
      }
    },
    // ... more models
  ]
}
```

### Get Model Details

```http
GET /v1/models/{model_id}
```

Get detailed information about a specific model.

### List Capabilities

```http
GET /v1/models/capabilities
```

Get all available capability types.

**Response:**
```json
{
  "capabilities": [
    "chat",
    "vision",
    "function_calling",
    "streaming",
    "fim",
    "embeddings",
    "audio",
    "video"
  ]
}
```

### List Model Types

```http
GET /v1/models/types
```

Get all model type categories.

**Response:**
```json
{
  "types": [
    "text",
    "vision",
    "code",
    "embeddings",
    "audio",
    "multimodal"
  ]
}
```

### Filter by Capability

```http
GET /v1/models/by-capability/{capability}
```

Get models that support a specific capability.

**Examples:**
- `/v1/models/by-capability/vision` - Models with vision support
- `/v1/models/by-capability/function_calling` - Models with tool use
- `/v1/models/by-capability/fim` - Code completion models

### Filter by Type

```http
GET /v1/models/by-type/{type}
```

Get models of a specific type.

**Examples:**
- `/v1/models/by-type/code` - Code-specialized models
- `/v1/models/by-type/vision` - Vision models
- `/v1/models/by-type/embeddings` - Embedding models

## Model Capabilities

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| `chat` | Text-based conversation |
| `streaming` | Real-time response streaming |
| `function_calling` | Tool and function calling |
| `vision` | Image understanding |
| `fim` | Fill-in-the-middle code completion |
| `embeddings` | Vector embeddings generation |
| `audio` | Audio processing |
| `video` | Video understanding |

### Advanced Features

Some models support additional features:

- **Large Context Windows** - Up to 1M+ tokens
- **System Messages** - Custom system prompts
- **JSON Mode** - Structured output
- **Web Search** - Internet-grounded responses
- **Multi-turn** - Conversation history
- **Fine-tuning** - Custom model training

## Model Selection

### By Use Case

**General Chat:**
- `claude-3-5-sonnet-20241022` - Balanced performance
- `gpt-4o` - OpenAI flagship
- `gemini-2.0-flash-exp` - Fast and capable

**Code Generation:**
- `claude-3-5-sonnet-20241022` - Best overall
- `mistral-codestral-latest` - FIM optimized
- `deepseek-coder` - Cost-effective

**Vision Tasks:**
- `claude-3-5-sonnet-20241022` - Best vision understanding
- `gpt-4o` - Strong vision support
- `gemini-2.0-flash-exp` - Fast vision processing

**Cost-Optimized:**
- `claude-3-5-haiku-20241022` - Fast and cheap
- `gpt-4o-mini` - Budget-friendly
- `gemini-2.0-flash-exp` - Free tier available

**Long Context:**
- `claude-3-5-sonnet-20241022` - 200K tokens
- `gemini-1.5-pro-latest` - 2M tokens
- `gpt-4-turbo` - 128K tokens

### By Pricing

Models are categorized by cost multiplier:

- **Free (0x)** - No cost
- **Cheap (1-2x)** - Base cost
- **Mid-tier (3-5x)** - Balanced performance/cost
- **Expensive (9x+)** - Premium models

## Model Metadata

Each model includes:

```typescript
{
  id: string;              // Model identifier
  object: "model";
  created: number;         // Unix timestamp
  owned_by: string;        // Provider name
  capabilities: string[];  // Supported capabilities
  context_window: number;  // Max context size
  pricing: {
    input: number;         // Per 1K input tokens
    output: number;        // Per 1K output tokens
  };
  max_output: number;      // Max output tokens
  type: string;           // Model category
}
```

## Provider Coverage

### Supported Providers

- **Anthropic** - Claude models
- **OpenAI** - GPT models
- **Google** - Gemini models
- **Mistral** - Mistral & Codestral
- **DeepSeek** - DeepSeek models
- **Meta** - Llama models (via providers)
- **Groq** - Fast inference
- **Together AI** - Open source models
- **Replicate** - Community models
- **Cloudflare AI** - Workers AI
- **Ollama** - Local models
- **And 30+ more**

Full provider list available in the [source code](https://github.com/nicholasgriffintn/assistant/blob/main/apps/api/src/lib/providers/index.ts).

## Model Routing

The API includes intelligent model routing to automatically select the best model based on:

- Request requirements (vision, tools, etc.)
- Cost preferences
- Performance needs
- Availability

Use `auto` as the model ID to enable automatic routing:

```json
{
  "model": "auto",
  "messages": [...]
}
```

## Best Practices

1. **Check Capabilities** - Use capability filtering to find models with required features
2. **Consider Context** - Choose models with sufficient context windows for your use case
3. **Balance Cost** - Evaluate pricing vs performance for your application
4. **Test Multiple** - Try different models to find the best fit
5. **Use Routing** - Let automatic routing handle model selection

## Examples

### Find Vision Models

```bash
curl https://api.polychat.app/v1/models/by-capability/vision
```

### Get Cheapest Chat Model

```bash
# List all models and filter by pricing
curl https://api.polychat.app/v1/models | jq '.data | sort_by(.pricing.input) | .[0]'
```

### Compare Model Context Windows

```bash
curl https://api.polychat.app/v1/models | jq '.data | map({id, context_window}) | sort_by(.context_window) | reverse'
```

## Related Features

- [Chat Completions](./chat-completions.md) - Use models for chat
- [Code Generation](./code-generation.md) - Code-specific models
- [Agents](./agents.md) - Assign models to agents
