import type { ProviderRegistry } from "../ProviderRegistry";
import type { ProviderRegistration } from "../types";
import type { AIProvider } from "../../capabilities/chat/providers/base";
import { AnthropicProvider } from "../../capabilities/chat/providers/anthropic";
import { AzureOpenAIProvider } from "../../capabilities/chat/providers/azure";
import { BedrockProvider } from "../../capabilities/chat/providers/bedrock";
import { CertesiaProvider } from "../../capabilities/chat/providers/certesia";
import { ChutesProvider } from "../../capabilities/chat/providers/chutes";
import { DeepInfraProvider } from "../../capabilities/chat/providers/deepinfra";
import { DeepSeekProvider } from "../../capabilities/chat/providers/deepseek";
import { ElevenLabsProvider } from "../../capabilities/chat/providers/elevenlabs";
import { FireworksProvider } from "../../capabilities/chat/providers/fireworks";
import { GithubModelsProvider } from "../../capabilities/chat/providers/github";
import { GithubCopilotProvider } from "../../capabilities/chat/providers/githubcopilot";
import { GoogleStudioProvider } from "../../capabilities/chat/providers/googlestudio";
import { GrokProvider } from "../../capabilities/chat/providers/grok";
import { GroqProvider } from "../../capabilities/chat/providers/groq";
import { HuggingFaceProvider } from "../../capabilities/chat/providers/huggingface";
import { HyperbolicProvider } from "../../capabilities/chat/providers/hyperbolic";
import { InceptionProvider } from "../../capabilities/chat/providers/inception";
import { InferenceProvider } from "../../capabilities/chat/providers/inference";
import { MistralProvider } from "../../capabilities/chat/providers/mistral";
import { MorphProvider } from "../../capabilities/chat/providers/morph";
import { OllamaProvider } from "../../capabilities/chat/providers/ollama";
import { OpenAIProvider } from "../../capabilities/chat/providers/openai";
import { OpenRouterProvider } from "../../capabilities/chat/providers/openrouter";
import { ParallelProvider } from "../../capabilities/chat/providers/parallel";
import { PerplexityProvider } from "../../capabilities/chat/providers/perplexity";
import { ReplicateProvider } from "../../capabilities/chat/providers/replicate";
import { PollyProvider } from "../../capabilities/chat/providers/polly";
import { RequestyProvider } from "../../capabilities/chat/providers/requesty";
import { TogetherAiProvider } from "../../capabilities/chat/providers/together-ai";
import { UpstageProvider } from "../../capabilities/chat/providers/upstage";
import { V0Provider } from "../../capabilities/chat/providers/v0";
import { VercelGatewayProvider } from "../../capabilities/chat/providers/vercel";
import { WorkersProvider } from "../../capabilities/chat/providers/workers";
import { ExaProvider } from "../../capabilities/chat/providers/exa";
import { FalAIProvider } from "../../capabilities/chat/providers/fal";
import { CerebrasProvider } from "../../capabilities/chat/providers/cerebras";
import { IdeogramProvider } from "../../capabilities/chat/providers/ideogram";

const chatProviders: ProviderRegistration<AIProvider>[] = [
	{
		name: "anthropic",
		create: () => new AnthropicProvider(),
		metadata: { vendor: "Anthropic", categories: ["chat"], tags: ["claude"] },
	},
	{
		name: "azure-openai",
		aliases: ["azure"],
		create: () => new AzureOpenAIProvider(),
		metadata: { vendor: "Microsoft", categories: ["chat"], tags: ["azure"] },
	},
	{
		name: "bedrock",
		aliases: ["aws-bedrock"],
		create: () => new BedrockProvider(),
		metadata: { vendor: "AWS", categories: ["chat"], tags: ["multi-provider"] },
	},
	{
		name: "chutes",
		create: () => new ChutesProvider(),
		metadata: { vendor: "Chutes", categories: ["chat"] },
	},
	{
		name: "deepinfra",
		create: () => new DeepInfraProvider(),
		metadata: { vendor: "DeepInfra", categories: ["chat"] },
	},
	{
		name: "deepseek",
		create: () => new DeepSeekProvider(),
		metadata: { vendor: "DeepSeek", categories: ["chat"] },
	},
	{
		name: "fireworks",
		create: () => new FireworksProvider(),
		metadata: { vendor: "Fireworks AI", categories: ["chat"] },
	},
	{
		name: "github-models",
		aliases: ["github"],
		create: () => new GithubModelsProvider(),
		metadata: { vendor: "GitHub", categories: ["chat"] },
	},
	{
		name: "github-copilot",
		create: () => new GithubCopilotProvider(),
		metadata: { vendor: "GitHub", categories: ["chat"], tags: ["pairing"] },
	},
	{
		name: "google-ai-studio",
		aliases: ["google", "googleai"],
		create: () => new GoogleStudioProvider(),
		metadata: { vendor: "Google", categories: ["chat"] },
	},
	{
		name: "grok",
		create: () => new GrokProvider(),
		metadata: { vendor: "xAI", categories: ["chat"], tags: ["reasoning"] },
	},
	{
		name: "groq",
		create: () => new GroqProvider(),
		metadata: { vendor: "Groq", categories: ["chat"], tags: ["fast"] },
	},
	{
		name: "huggingface",
		create: () => new HuggingFaceProvider(),
		metadata: { vendor: "Hugging Face", categories: ["chat"] },
	},
	{
		name: "hyperbolic",
		create: () => new HyperbolicProvider(),
		metadata: { vendor: "Hyperbolic", categories: ["chat"] },
	},
	{
		name: "inception",
		create: () => new InceptionProvider(),
		metadata: { vendor: "Modal Labs", categories: ["chat"] },
	},
	{
		name: "inference",
		create: () => new InferenceProvider(),
		metadata: { vendor: "Replicate", categories: ["chat"], tags: ["router"] },
	},
	{
		name: "mistral",
		create: () => new MistralProvider(),
		metadata: { vendor: "Mistral AI", categories: ["chat"] },
	},
	{
		name: "morph",
		create: () => new MorphProvider(),
		metadata: { vendor: "Morph", categories: ["chat"] },
	},
	{
		name: "ollama",
		create: () => new OllamaProvider(),
		metadata: { vendor: "Ollama", categories: ["chat"], tags: ["local"] },
	},
	{
		name: "openai",
		aliases: ["gpt"],
		create: () => new OpenAIProvider(),
		metadata: { vendor: "OpenAI", categories: ["chat"] },
	},
	{
		name: "openrouter",
		create: () => new OpenRouterProvider(),
		metadata: { vendor: "OpenRouter", categories: ["chat"], tags: ["meta"] },
	},
	{
		name: "parallel",
		create: () => new ParallelProvider(),
		metadata: { vendor: "Parallel", categories: ["chat"] },
	},
	{
		name: "perplexity",
		aliases: ["perplexity-ai"],
		create: () => new PerplexityProvider(),
		metadata: { vendor: "Perplexity", categories: ["chat", "search"] },
	},
	{
		name: "replicate",
		create: () => new ReplicateProvider(),
		metadata: { vendor: "Replicate", categories: ["chat"] },
	},
	{
		name: "certesia",
		create: () => new CertesiaProvider(),
		metadata: { vendor: "Cartesia", categories: ["chat", "audio"] },
	},
	{
		name: "cerebras",
		create: () => new CerebrasProvider(),
		metadata: { vendor: "Cerebras", categories: ["chat", "audio"] },
	},
	{
		name: "elevenlabs",
		create: () => new ElevenLabsProvider(),
		metadata: { vendor: "ElevenLabs", categories: ["chat", "audio"] },
	},
	{
		name: "polly",
		create: () => new PollyProvider(),
		metadata: { vendor: "AWS", categories: ["chat", "audio"] },
	},
	{
		name: "requesty",
		create: () => new RequestyProvider(),
		metadata: { vendor: "Requesty", categories: ["chat"] },
	},
	{
		name: "together-ai",
		aliases: ["together"],
		create: () => new TogetherAiProvider(),
		metadata: { vendor: "Together AI", categories: ["chat"] },
	},
	{
		name: "upstage",
		create: () => new UpstageProvider(),
		metadata: { vendor: "Upstage", categories: ["chat"] },
	},
	{
		name: "v0",
		create: () => new V0Provider(),
		metadata: { vendor: "Vercel", categories: ["chat"] },
	},
	{
		name: "vercel",
		aliases: ["vercel-gateway"],
		create: () => new VercelGatewayProvider(),
		metadata: { vendor: "Vercel", categories: ["chat"] },
	},
	{
		name: "workers",
		aliases: ["workers-ai"],
		create: () => new WorkersProvider(),
		metadata: { vendor: "Cloudflare", categories: ["chat"] },
	},
	{
		name: "exa",
		create: () => new ExaProvider(),
		metadata: { vendor: "Exa", categories: ["chat", "research"] },
	},
	{
		name: "fal",
		create: () => new FalAIProvider(),
		metadata: { vendor: "Fal AI", categories: ["chat", "image", "video"] },
	},
	{
		name: "ideogram",
		create: () => new IdeogramProvider(),
		metadata: { vendor: "Ideogram", categories: ["chat", "image"] },
	},
];

export function registerChatProviders(registry: ProviderRegistry): void {
	for (const registration of chatProviders) {
		registry.register("chat", registration);
	}
}
