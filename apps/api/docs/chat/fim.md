# Fill-in-the-Middle (FIM) Completions

## Supported Models
- Mistral: `codestral-latest`, `devstral-small-2507`, `devstral-medium-2507`
- Mercury: `mercury-coder`

## API Endpoint
POST `/v1/fim/completions`

## Example Request
```bash
curl https://your-api.com/v1/fim/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type": "application/json" \
  -d '{
    "model": "codestral-latest",
    "prompt": "def fibonacci(n: int):",
    "suffix": "\nn = int(input(\"Enter a number: \"))\nprint(fibonacci(n))",
    "max_tokens": 100
  }'
```

## Key Advantages
- Unified request format shared across providers.
- Minimal provider-specific logic since only endpoints differ.
- Straightforward to extend with additional FIM-capable models.
- Dedicated service keeps FIM concerns separate from chat completions.
- Supports both streaming and non-streaming responses.
