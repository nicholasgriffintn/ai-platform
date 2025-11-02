export const getProviderColor = (provider: string): string => {
	switch (provider?.toLowerCase()) {
		case "openai":
			return "text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/30";
		case "anthropic":
			return "text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-900/30";
		case "google-ai-studio":
		case "googleai":
		case "google":
			return "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30";
		case "mistral":
			return "text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-900/30";
		case "groq":
			return "text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/30";
		case "perplexity-ai":
			return "text-pink-700 bg-pink-50 dark:text-pink-300 dark:bg-pink-900/30";
		case "deepseek":
			return "text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-900/30";
		case "bedrock":
			return "text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-900/30";
		case "together-ai":
			return "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30";
		case "grok":
			return "text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-900/30";
		case "web-llm":
			return "text-gray-700 bg-gray-50 dark:text-gray-300 dark:bg-gray-900/30";
		default:
			return "text-gray-700 bg-gray-50 dark:text-gray-300 dark:bg-gray-800/50";
	}
};
