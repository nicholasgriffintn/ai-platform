export const TEST_USERS = {
	validUser: {
		email: "test@example.com",
		password: "password123",
	},
	adminUser: {
		email: "admin@example.com",
		password: "admin123",
	},
} as const;

export const TEST_MESSAGES = {
	simple: "Hello, how are you?",
	complex: "Write a detailed explanation about quantum computing",
	codeRequest: "Write a Python function to calculate fibonacci numbers",
	multiline:
		"This is a multi-line message.\n\nIt has several paragraphs.\n\nEach separated by blank lines.",
	withSpecialChars: "Can you explain: @mentions, #hashtags, and $variables?",
	veryShort: "Hi",
	followUp: "Can you elaborate on that?",
	contextDependent: "What was the previous topic we discussed?",
} as const;

export const MOCK_RESPONSES = {
	greeting:
		"Hello! I'm doing well, thank you for asking. How can I help you today?",
	quantum: "Quantum computing is a revolutionary computing paradigm...",
	fibonacci: `Here's a Python function to calculate Fibonacci numbers:

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\``,
} as const;

export const CHAT_TEST_SCENARIOS = {
	multiTurn: [
		{
			message: "What is the capital of France?",
			expectation: /Paris/i,
		},
		{
			message: "What is its population?",
			expectation: /population|million|people/i,
		},
		{
			message: "Tell me about its famous landmarks",
			expectation: /Eiffel Tower|Louvre|Notre|Dame/i,
		},
	],
	codeGeneration: [
		{
			message: "Write a simple hello world in JavaScript",
			expectation: /console\.log|Hello|World/i,
		},
		{
			message: "Now convert it to TypeScript",
			expectation: /typescript|string|console\.log/i,
		},
	],
	structuredData: [
		{
			message: "List 3 programming languages as a numbered list",
			expectation: /1\.|2\.|3\./,
		},
		{
			message: "Now format them as JSON",
			expectation: /\{|\[|"|languages/i,
		},
	],
} as const;

type PromptCheck = {
	name: string;
	message: string;
	expectations: Array<string | RegExp>;
};

export const CORE_PROMPTS: PromptCheck[] = [
	{
		name: "deterministic acknowledgement",
		message:
			"Respond with the exact text 'PLAYWRIGHT_HELLO'. Do not include any other characters.",
		expectations: [/PLAYWRIGHT_HELLO/],
	},
	{
		name: "structured summary",
		message:
			"Return valid JSON that includes the keys status and summary. Set status to \"ok\" and include the text 'e2e-check' inside the summary value. Reply with JSON only.",
		expectations: [/"status"\s*:\s*"ok"/i, /e2e-check/i],
	},
	{
		name: "code generation",
		message:
			"Write a concise TypeScript function named addNumbers that sums two numbers. Include the exact snippet 'function addNumbers'.",
		expectations: [/function addNumbers/i, /\+\s*b/],
	},
];

export const API_ENDPOINTS = {
	chat: "**/api/chat/completions",
	models: "**/api/models",
	auth: "**/api/auth/**",
} as const;
