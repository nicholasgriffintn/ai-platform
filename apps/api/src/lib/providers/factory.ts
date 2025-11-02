import { AnthropicProvider } from "./provider/anthropic";
import { AzureOpenAIProvider } from "./provider/azure";
import type { AIProvider } from "./provider/base";
import { BedrockProvider } from "./provider/bedrock";
import { CertesiaProvider } from "./provider/certesia";
import { ChutesProvider } from "./provider/chutes";
import { DeepInfraProvider } from "./provider/deepinfra";
import { DeepSeekProvider } from "./provider/deepseek";
import { ElevenLabsProvider } from "./provider/elevenlabs";
import { FireworksProvider } from "./provider/fireworks";
import { GithubModelsProvider } from "./provider/github";
import { GithubCopilotProvider } from "./provider/githubcopilot";
import { GoogleStudioProvider } from "./provider/googlestudio";
import { GrokProvider } from "./provider/grok";
import { GroqProvider } from "./provider/groq";
import { HuggingFaceProvider } from "./provider/huggingface";
import { HyperbolicProvider } from "./provider/hyperbolic";
import { InceptionProvider } from "./provider/inception";
import { InferenceProvider } from "./provider/inference";
import { MistralProvider } from "./provider/mistral";
import { MorphProvider } from "./provider/morph";
import { OllamaProvider } from "./provider/ollama";
import { OpenAIProvider } from "./provider/openai";
import { OpenRouterProvider } from "./provider/openrouter";
import { ParallelProvider } from "./provider/parallel";
import { PerplexityProvider } from "./provider/perplexity";
import { PollyProvider } from "./provider/polly";
import { ReplicateProvider } from "./provider/replicate";
import { RequestyProvider } from "./provider/requesty";
import { TogetherAiProvider } from "./provider/together-ai";
import { UpstageProvider } from "./provider/upstage";
import { V0Provider } from "./provider/v0";
import { VercelGatewayProvider } from "./provider/vercel";
import { WorkersProvider } from "./provider/workers";

export interface ProviderConfig {
  key: string;
  provider: AIProvider;
  aliases?: string[];
}

export class AIProviderFactory {
  private static providerConfigs: ProviderConfig[] = [
    { key: "anthropic", provider: new AnthropicProvider() },
    { key: "grok", provider: new GrokProvider() },
    { key: "huggingface", provider: new HuggingFaceProvider() },
    { key: "perplexity-ai", provider: new PerplexityProvider() },
    { key: "replicate", provider: new ReplicateProvider() },
    { key: "mistral", provider: new MistralProvider() },
    { key: "morph", provider: new MorphProvider() },
    { key: "openrouter", provider: new OpenRouterProvider() },
    { key: "workers", provider: new WorkersProvider() },
    { key: "bedrock", provider: new BedrockProvider() },
    { key: "openai", provider: new OpenAIProvider() },
    {
      key: "google-ai-studio",
      provider: new GoogleStudioProvider(),
      aliases: ["google", "googleai"],
    },
    { key: "groq", provider: new GroqProvider() },
    { key: "ollama", provider: new OllamaProvider() },
    {
      key: "github-models",
      provider: new GithubModelsProvider(),
      aliases: ["github"],
    },
    { key: "deepinfra", provider: new DeepInfraProvider() },
    { key: "deepseek", provider: new DeepSeekProvider() },
    { key: "together-ai", provider: new TogetherAiProvider() },
    { key: "certesia", provider: new CertesiaProvider() },
    { key: "elevenlabs", provider: new ElevenLabsProvider() },
    { key: "polly", provider: new PollyProvider() },
    { key: "requesty", provider: new RequestyProvider() },
    { key: "fireworks", provider: new FireworksProvider() },
    { key: "hyperbolic", provider: new HyperbolicProvider() },
    { key: "vercel", provider: new VercelGatewayProvider() },
    { key: "azure-openai", provider: new AzureOpenAIProvider() },
    { key: "github-copilot", provider: new GithubCopilotProvider() },
    { key: "chutes", provider: new ChutesProvider() },
    { key: "upstage", provider: new UpstageProvider() },
    { key: "inference", provider: new InferenceProvider() },
    { key: "inception", provider: new InceptionProvider() },
    { key: "v0", provider: new V0Provider() },
    { key: "parallel", provider: new ParallelProvider() },
  ];

  /**
   * Provider instances mapped by key
   */
  private static providers: Record<string, AIProvider> = (() => {
    const providers: Record<string, AIProvider> = {};

    for (const config of AIProviderFactory.providerConfigs) {
      providers[config.key] = config.provider;

      if (config.aliases) {
        for (const alias of config.aliases) {
          providers[alias] = config.provider;
        }
      }
    }

    return providers;
  })();

  /**
   * Get all available provider keys
   * @returns The available provider keys
   */
  static getProviders(): string[] {
    return Object.keys(AIProviderFactory.providers);
  }

  /**
   * Get the configurable providers
   */
  static getConfigurableProviders(): string[] {
    const ignoredProviders = [
      "ollama",
      "workers",
      "workers-ai",
      "google",
      "googleai",
      "github",
    ];
    return AIProviderFactory.getProviders().filter((provider) => {
      return !ignoredProviders.includes(provider);
    });
  }

  /**
   * Get a provider by name
   * Falls back to workers provider if not found
   * @param providerName - The name of the provider
   * @returns The provider
   */
  static getProvider(providerName: string): AIProvider {
    return (
      AIProviderFactory.providers[providerName] ||
      AIProviderFactory.providers.workers
    );
  }

  /**
   * Register a new provider
   */
  static registerProvider(config: ProviderConfig): void {
    AIProviderFactory.providerConfigs.push(config);

    AIProviderFactory.providers[config.key] = config.provider;

    if (config.aliases) {
      for (const alias of config.aliases) {
        AIProviderFactory.providers[alias] = config.provider;
      }
    }
  }
}
