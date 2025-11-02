import { md } from "~/utils/markdown.js";

export const modelsTagDescription = md`
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

## Model Capabilities

### Core Capabilities

| Capability         | Description                        |
| ------------------ | ---------------------------------- |
| \`chat\`             | Text-based conversation            |
| \`streaming\`        | Real-time response streaming       |
| \`function_calling\` | Tool and function calling          |
| \`vision\`           | Image understanding                |
| \`fim\`              | Fill-in-the-middle code completion |
| \`embeddings\`       | Vector embeddings generation       |
| \`audio\`            | Audio processing                   |
| \`video\`            | Video understanding                |

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

- \`claude-3-5-sonnet-20241022\` - Balanced performance
- \`gpt-4o\` - OpenAI flagship
- \`gemini-2.0-flash-exp\` - Fast and capable

**Code Generation:**

- \`claude-3-5-sonnet-20241022\` - Best overall
- \`mistral-codestral-latest\` - FIM optimized
- \`deepseek-coder\` - Cost-effective

**Vision Tasks:**

- \`claude-3-5-sonnet-20241022\` - Best vision understanding
- \`gpt-4o\` - Strong vision support
- \`gemini-2.0-flash-exp\` - Fast vision processing

**Cost-Optimized:**

- \`claude-3-5-haiku-20241022\` - Fast and cheap
- \`gpt-4o-mini\` - Budget-friendly
- \`gemini-2.0-flash-exp\` - Free tier available

**Long Context:**

- \`claude-3-5-sonnet-20241022\` - 200K tokens
- \`gemini-1.5-pro-latest\` - 2M tokens
- \`gpt-4-turbo\` - 128K tokens

### By Pricing

Models are categorized by cost multiplier:

- **Free (0x)** - No cost
- **Cheap (1-2x)** - Base cost
- **Mid-tier (3-5x)** - Balanced performance/cost
- **Expensive (9x+)** - Premium models

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

Use \`auto\` as the model ID to enable automatic routing:

~~~json
{
  "model": "auto",
  "messages": [...]
}
~~~

## Best Practices

1. **Check Capabilities** - Use capability filtering to find models with required features
2. **Consider Context** - Choose models with sufficient context windows for your use case
3. **Balance Cost** - Evaluate pricing vs performance for your application
4. **Test Multiple** - Try different models to find the best fit
5. **Use Routing** - Let automatic routing handle model selection

## Examples

### Find Vision Models

~~~bash
curl https://api.polychat.app/v1/models/by-capability/vision
~~~

### Get Cheapest Chat Model

~~~bash
# List all models and filter by pricing
curl https://api.polychat.app/v1/models | jq '.data | sort_by(.pricing.input) | .[0]'
~~~

### Compare Model Context Windows

~~~bash
curl https://api.polychat.app/v1/models | jq '.data | map({id, context_window}) | sort_by(.context_window) | reverse'
~~~
`;
