export const getProviderColor = (provider: string): string => {
  switch (provider?.toLowerCase()) {
    case "openai":
      return "text-accent-green bg-accent-green/12";
    case "anthropic":
      return "text-accent-purple bg-accent-purple/12";
    case "google-ai-studio":
    case "googleai":
    case "google":
      return "text-accent-blue bg-accent-blue/12";
    case "mistral":
      return "text-accent-indigo bg-accent-indigo/12";
    case "groq":
      return "text-accent-orange bg-accent-orange/12";
    case "perplexity-ai":
      return "text-accent-pink bg-accent-pink/12";
    case "deepseek":
      return "text-accent-teal bg-accent-teal/12";
    case "bedrock":
      return "text-accent-yellow bg-accent-yellow/12";
    case "together-ai":
      return "text-accent-red bg-accent-red/12";
    case "grok":
      return "text-accent-purple bg-accent-purple/12";
    case "web-llm":
      return "text-muted-foreground bg-selection/60";
    default:
      return "text-muted-foreground bg-selection";
  }
};
