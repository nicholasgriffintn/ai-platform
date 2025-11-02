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

export const API_ENDPOINTS = {
	chat: "**/api/chat/completions",
	models: "**/api/models",
	auth: "**/api/auth/**",
} as const;
