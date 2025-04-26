import { AnthropicProvider } from "./anthropic";
import type { AIProvider } from "./base";
import { BedrockProvider } from "./bedrock";
import { CertesiaProvider } from "./certesia";
import { DeepSeekProvider } from "./deepseek";
import { ElevenLabsProvider } from "./elevenlabs";
import { FireworksProvider } from "./fireworks";
import { GithubModelsProvider } from "./github";
import { GoogleStudioProvider } from "./googlestudio";
import { GrokProvider } from "./grok";
import { GroqProvider } from "./groq";
import { HuggingFaceProvider } from "./huggingface";
import { HyperbolicProvider } from "./hyperbolic";
import { MistralProvider } from "./mistral";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import { OpenRouterProvider } from "./openrouter";
import { PerplexityProvider } from "./perplexity";
import { PollyProvider } from "./polly";
import { ReplicateProvider } from "./replicate";
import { TogetherAiProvider } from "./together-ai";
import { WorkersProvider } from "./workers";

export interface ProviderConfig {
  key: string;
  provider: AIProvider;
  aliases?: string[];
}

// biome-ignore lint/complexity/noStaticOnlyClass: CBA
export class AIProviderFactory {
  private static providerConfigs: ProviderConfig[] = [
    { key: "anthropic", provider: new AnthropicProvider() },
    { key: "grok", provider: new GrokProvider() },
    { key: "huggingface", provider: new HuggingFaceProvider() },
    { key: "perplexity-ai", provider: new PerplexityProvider() },
    { key: "replicate", provider: new ReplicateProvider() },
    { key: "mistral", provider: new MistralProvider() },
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
    { key: "deepseek", provider: new DeepSeekProvider() },
    { key: "together-ai", provider: new TogetherAiProvider() },
    { key: "certesia", provider: new CertesiaProvider() },
    { key: "elevenlabs", provider: new ElevenLabsProvider() },
    { key: "polly", provider: new PollyProvider() },
    { key: "fireworks", provider: new FireworksProvider() },
    { key: "hyperbolic", provider: new HyperbolicProvider() },
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
