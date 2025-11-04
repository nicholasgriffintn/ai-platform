import { md } from "~/utils/markdown.js";

export const guardrailsTagDescription = md`
# Guardrails

Content safety and moderation using Llamaguard and AWS Bedrock Guardrails.

## Overview

Guardrails protect your application by validating content for safety violations. The system supports two providers:

- **Llamaguard** - Meta's content moderation model (default, free)
- **AWS Bedrock Guardrails** - Enterprise-grade filtering (requires AWS setup)

## How It Works

1. **User Settings** - Enable guardrails in your user settings
2. **Validation** - Input and/or output content is checked against safety policies
3. **Response** - Returns validation status and any violations found
4. **Monitoring** - Violations are tracked in Analytics Engine

## Configuration

### User Settings

Guardrails are configured per-user via settings:

- \`guardrails_enabled\` (boolean) - Enable/disable guardrails
- \`guardrails_provider\` (string) - \`"llamaguard"\` or \`"bedrock"\`

### Bedrock Settings

If using Bedrock, also configure:

- \`bedrock_guardrail_id\` (string) - Your Bedrock guardrail ID
- \`bedrock_guardrail_version\` (string) - Version (default: "1")

## Providers

### Llamaguard

Meta's Llama Guard model for content moderation.

**Features:**

- Free to use
- Runs on Cloudflare Workers AI
- Fast response (~200-500ms)
- 13 safety categories

**Categories:**

| Code | Category               |
| ---- | ---------------------- |
| S1   | Violent Crimes         |
| S2   | Non-Violent Crimes     |
| S3   | Sex Crimes             |
| S4   | Child Exploitation     |
| S5   | Defamation             |
| S6   | Specialized Advice     |
| S7   | Privacy                |
| S8   | Intellectual Property  |
| S9   | Indiscriminate Weapons |
| S10  | Hate                   |
| S11  | Self-Harm              |
| S12  | Sexual Content         |
| S13  | Elections              |

**Response:**

- Returns \`"safe"\` or \`"unsafe"\`
- If unsafe, includes violated category codes

### AWS Bedrock Guardrails

Amazon's enterprise guardrails service.

**Features:**

- Enterprise-grade filtering
- PII detection
- Custom content policies
- Topic-based filtering
- Requires AWS credentials and guardrail configuration

**Setup Required:**

1. AWS account with Bedrock access
2. Created guardrail in AWS Bedrock
3. AWS credentials configured in environment:
   - \`BEDROCK_AWS_ACCESS_KEY\`
   - \`BEDROCK_AWS_SECRET_KEY\`
   - \`AWS_REGION\` (default: "us-east-1")

**Response Structure:**

- Topic policy violations
- Content filter violations
- PII entity detections

## Validation

### Input Validation

Validates user messages before processing:

~~~typescript
const result = await guardrails.validateInput(message, userId, completionId);

if (!result.isValid) {
	// Handle violation
}
~~~

### Output Validation

Validates model responses before returning:

~~~typescript
const result = await guardrails.validateOutput(response, userId, completionId);

if (!result.isValid) {
	// Handle violation
}
~~~

### Validation Result

~~~typescript
{
  isValid: boolean;
  violations: string[];
  rawResponse?: string;
}
~~~

## Integration

### Chat Completions

Guardrails are automatically applied during chat completions if enabled in user settings.

The system validates:

- User input messages (before processing)
- Model output (after generation)

Results are included in the response:

~~~json
{
  "id": "cmpl_abc123",
  "choices": [...],
  "post_processing": {
    "guardrails": {
      "passed": true
    }
  }
}
~~~

Or if violations occur:

~~~json
{
	"post_processing": {
		"guardrails": {
			"passed": false,
			"error": "Content policy violation",
			"violations": ["S10: Hate"]
		}
	}
}
~~~

## Monitoring

Violations are automatically tracked to Cloudflare Analytics Engine with:

- Violation type (\`input_violation\` or \`output_violation\`)
- User ID
- Completion ID
- Violation details

## Limitations

- **No custom policies** - Cannot define custom word filters or regex patterns
- **No per-request configuration** - Settings are user-level only
- **No dedicated endpoint** - Only \`/v1/chat/completions/{id}/check\` exists
- **No bypass rules** - Cannot configure exemptions
- **No action types** - Only returns validation status (no redaction, warnings, etc.)
- **No stats endpoint** - No aggregated violation statistics API

## Examples

### Check a Conversation

~~~bash
curl -X POST https://api.polychat.app/v1/chat/completions/cmpl_abc123/check \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "role": "user"
  }'
~~~

### Enable Guardrails (User Settings)

Guardrails must be enabled via user settings. There's no per-request parameter to enable them.

## Best Practices

1. **Enable for Production** - Use guardrails for user-facing applications
2. **Choose Provider** - Llamaguard for speed/cost, Bedrock for accuracy
3. **Monitor Violations** - Track violations in analytics
4. **Handle Failures** - Implement fallbacks if guardrail validation fails
5. **Test Thoroughly** - Test with various content types before deployment
`;
