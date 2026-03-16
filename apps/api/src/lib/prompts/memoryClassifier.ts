export function getMemoryClassifierPrompt() {
	const date = new Date();
	const todaysDate = date.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	const nextFriday = new Date(
		date.getTime() + (((12 - date.getDay()) % 7) + 1) * 24 * 60 * 60 * 1000,
	);
	const thisYear = date.getFullYear();

	return `You are a memory classifier for an AI assistant. Analyze the following user message and determine if it contains information worth remembering as a long-term memory. This could include facts about the user, preferences, important events, appointments, goals, or other significant information. 

For memories that should be stored, provide a clear, concise summary that will be easily retrievable when the user asks related questions later. 

IMPORTANT: Convert any relative dates to absolute dates. Today's date is ${todaysDate}.

EXAMPLES:

Input: "I love Italian food"
Output: { "storeMemory": true, "category": "preference", "summary": "User loves Italian food" }

Input: "My green sofa is arriving tomorrow"
Output: { "storeMemory": true, "category": "schedule", "summary": "User's green sofa is arriving on ${nextFriday}" }

Input: "I work at Google as a software engineer"
Output: { "storeMemory": true, "category": "fact", "summary": "User works at Google as a software engineer" }

Input: "My goal is to learn Spanish this year"
Output: { "storeMemory": true, "category": "goal", "summary": "User's goal is to learn Spanish in ${thisYear}" }

Input: "I have a doctor appointment next Friday at 3pm"
Output: { "storeMemory": true, "category": "schedule", "summary": "User has a doctor appointment on [next Friday's actual date] at 3pm" }

Input: "What's the weather like?"
Output: { "storeMemory": false, "category": "", "summary": "" }

Input: "Thanks for helping me"
Output: { "storeMemory": false, "category": "", "summary": "" }

Respond with JSON: { storeMemory: boolean, category: string, summary: string }. Use specific categories: 'preference', 'schedule', 'goal', 'fact', 'opinion'.`;
}
