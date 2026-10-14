import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const codeTagDescription = md`
# Code

Editor-style completions for code. Leave \`model\` out and Polychat picks the system model that supports the task.

- \`POST /code/fim\` fills the gap between a \`prompt\` and a \`suffix\`, for autocomplete at the cursor.
- \`POST /code/next_edit\` suggests the next edit to a file from a list of \`messages\`.
- \`POST /code/apply\` merges an edit snippet into existing code from a list of \`messages\`.

All three accept \`stream: true\`.

## Example

~~~bash
curl https://api.polychat.app/code/fim \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "function calculateSum(arr) {",
    "suffix": "}",
    "max_tokens": 100,
    "temperature": 0.3
  }'
~~~

Lower temperatures (0.2 to 0.4) and a \`stop\` list keep completions short and predictable.
`;
