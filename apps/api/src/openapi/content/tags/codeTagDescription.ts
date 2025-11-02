import { md } from "~/utils/markdown.js";

export const codeTagDescription = md`
# Code Generation

Specialized endpoints for code completion, editing, and application using models optimized for coding tasks.

## Overview

The code generation features include:

- **Fill-in-the-Middle (FIM)** - Code completion at cursor position
- **Next Edit** - Suggest the next code change (Mercury model)
- **Apply** - Apply code snippets to existing files (Mercury model)

## Fill-in-the-Middle (FIM)

Complete code at a specific position using context before and after the cursor.

### Use Cases

- IDE autocomplete
- Code suggestion at cursor
- Context-aware code generation
- Inline code completion

### Supported Models

Models with FIM support (check via Models API):

- \`mistral-codestral-latest\` (Mistral)
- \`mistral-codestral-mamba-latest\` (Mistral)
- \`mercury-coder\` (Mercury)
- Other code-specialized models

## Next Edit

Get suggestions for the next code edit based on the current file and instruction.

### Use Cases

- Code refactoring suggestions
- Implementation of features
- Bug fix suggestions
- Code improvement recommendations

### Supported Models

Optimized for:

- \`mercury-coder\` (Mercury)

## Apply

Apply code snippets or patches to existing code.

### Use Cases

- Apply suggested changes
- Merge code snippets
- Apply diffs/patches
- Code transformation

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

~~~javascript
async function getCompletion(beforeCursor, afterCursor) {
	const response = await fetch(
		"https://api.polychat.app/v1/chat/fim/completions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer YOUR_TOKEN",
			},
			body: JSON.stringify({
				model: "mistral-codestral-latest",
				prompt: beforeCursor,
				suffix: afterCursor,
				max_tokens: 50,
				temperature: 0.3,
				stream: false,
			}),
		},
	);

	const data = await response.json();
	return data.choices[0].text;
}
~~~

### Code Refactoring

~~~javascript
async function suggestRefactoring(code, instruction) {
	const prompt = \`<|fim_prefix|>\${code}<|fim_suffix|>\\n\\n<|fim_instruction|>\${instruction}<|fim_instruction|>\`;

	const response = await fetch(
		"https://api.polychat.app/v1/chat/edit/completions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer YOUR_TOKEN",
			},
			body: JSON.stringify({
				model: "mercury-coder",
				messages: [{ role: "user", content: prompt }],
				stream: true,
			}),
		},
	);

	// Handle streaming response
	const reader = response.body.getReader();
	const decoder = new TextDecoder();

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;

		const chunk = decoder.decode(value);
		const lines = chunk
			.split("\\n")
			.filter((line) => line.startsWith("data: "));

		for (const line of lines) {
			if (line === "data: [DONE]") break;
			const json = JSON.parse(line.slice(6));
			console.log(json.choices[0].delta?.content || "");
		}
	}
}
~~~

## Examples

### FIM Completion

~~~bash
curl https://api.polychat.app/v1/chat/fim/completions \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "mistral-codestral-latest",
    "prompt": "function calculateSum(arr) {",
    "suffix": "}",
    "max_tokens": 100,
    "temperature": 0.3
  }'
~~~

### Next Edit

~~~bash
curl https://api.polychat.app/v1/chat/edit/completions \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type": application/json" \\
  -d '{
    "model": "mercury-coder",
    "messages": [
      {
        "role": "user",
        "content": "<|fim_prefix|>const data = [];<|fim_suffix|>\\n\\n<|fim_instruction|>Add error handling<|fim_instruction|>"
      }
    ]
  }'
~~~

### Apply Edit

~~~bash
curl https://api.polychat.app/v1/chat/apply/completions \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type": application/json" \\
  -d '{
    "model": "mercury-coder",
    "messages": [
      {
        "role": "user",
        "content": "<|fim_prefix|>function old() {<|fim_suffix|>}<|fim_middle|>  return new implementation;<|fim_middle|>"
      }
    ]
  }'
~~~
`;
