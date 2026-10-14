import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const guardrailsTagDescription = md`
# Guardrails

Content safety checks on input and output. Guardrails are on by default and configured per user, not per request.

## Providers

Set \`guardrails_provider\` in user settings:

- \`typesafe\` (default) judges content with the account's decision model and falls back to LlamaGuard when none is available.
- \`llamaguard\` runs Meta's Llama Guard on Workers AI.
- \`mistral\` uses Mistral's hosted moderation, including jailbreak detection.
- \`shieldstral\` calls an operator-managed Shieldstral endpoint for text, images and prompt-response pairs. It needs \`SHIELDSTRAL_BASE_URL\`, and optionally \`SHIELDSTRAL_API_KEY\`, \`SHIELDSTRAL_MODEL\`, \`SHIELDSTRAL_POLICY\`, \`SHIELDSTRAL_POLICY_VERSION\` and \`SHIELDSTRAL_THRESHOLD\`.
- \`bedrock\` uses AWS Bedrock Guardrails with \`bedrock_guardrail_id\` and \`bedrock_guardrail_version\` from user settings.

Set \`guardrails_enabled: false\` to turn checks off.

## Checking a conversation

\`POST /conversations/{conversation_id}/check\` checks the conversation as input when \`role\` is \`user\` (the default) and as output otherwise:

~~~bash
curl -X POST https://api.polychat.app/conversations/conv_123/check \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "role": "user" }'
~~~

~~~json
{
  "response": {
    "content": "Input is valid",
    "data": { "provider": "typesafe", "isValid": true, "violations": [] }
  }
}
~~~

Chat Completions reports the same outcome under \`post_processing.guardrails\`.
`;
