import { AlibabaProvider } from "../capabilities/chat/providers/alibaba.js";
import { AnthropicProvider } from "../capabilities/chat/providers/anthropic.js";
import { AzureOpenAIProvider } from "../capabilities/chat/providers/azure.js";
import type { AIProvider } from "../capabilities/chat/providers/base.js";
import { BedrockMantleProvider } from "../capabilities/chat/providers/bedrock-mantle.js";
import { BedrockProvider } from "../capabilities/chat/providers/bedrock.js";
import { CerebrasProvider } from "../capabilities/chat/providers/cerebras.js";
import { CertesiaProvider } from "../capabilities/chat/providers/certesia.js";
import { ChutesProvider } from "../capabilities/chat/providers/chutes.js";
import { CohereProvider } from "../capabilities/chat/providers/cohere.js";
import { CortecsProvider } from "../capabilities/chat/providers/cortecs.js";
import { DeepInfraProvider } from "../capabilities/chat/providers/deepinfra.js";
import { DeepSeekProvider } from "../capabilities/chat/providers/deepseek.js";
import { ElevenLabsProvider } from "../capabilities/chat/providers/elevenlabs.js";
import { ExaProvider } from "../capabilities/chat/providers/exa.js";
import { FalAIProvider } from "../capabilities/chat/providers/fal.js";
import { FireworksProvider } from "../capabilities/chat/providers/fireworks.js";
import { GithubCopilotProvider } from "../capabilities/chat/providers/githubcopilot.js";
import { GoogleVertexProvider } from "../capabilities/chat/providers/google-vertex.js";
import { GoogleStudioProvider } from "../capabilities/chat/providers/googlestudio.js";
import { GreenPtProvider } from "../capabilities/chat/providers/greenpt.js";
import { GrokProvider } from "../capabilities/chat/providers/grok.js";
import { GroqProvider } from "../capabilities/chat/providers/groq.js";
import { HetznerProvider } from "../capabilities/chat/providers/hetzner.js";
import { HuggingFaceProvider } from "../capabilities/chat/providers/huggingface.js";
import { HyperbolicProvider } from "../capabilities/chat/providers/hyperbolic.js";
import { IdeogramProvider } from "../capabilities/chat/providers/ideogram.js";
import { InceptionProvider } from "../capabilities/chat/providers/inception.js";
import { InferenceProvider } from "../capabilities/chat/providers/inference.js";
import { KimiForCodingProvider } from "../capabilities/chat/providers/kimi-for-coding.js";
import { LucidQueryProvider } from "../capabilities/chat/providers/lucidquery.js";
import { MetaProvider } from "../capabilities/chat/providers/meta.js";
import { MiniMaxProvider } from "../capabilities/chat/providers/minimax.js";
import { MistralProvider } from "../capabilities/chat/providers/mistral.js";
import { MoonshotProvider } from "../capabilities/chat/providers/moonshot.js";
import { MorphProvider } from "../capabilities/chat/providers/morph.js";
import { AmazonNovaProvider } from "../capabilities/chat/providers/nova.js";
import { OllamaCloudProvider } from "../capabilities/chat/providers/ollama-cloud.js";
import { OpenAIProvider } from "../capabilities/chat/providers/openai.js";
import { OpencodeGoProvider } from "../capabilities/chat/providers/opencode-go.js";
import { OpencodeProvider } from "../capabilities/chat/providers/opencode.js";
import { OpenRouterProvider } from "../capabilities/chat/providers/openrouter.js";
import { OvhCloudProvider } from "../capabilities/chat/providers/ovhcloud.js";
import { ParallelProvider } from "../capabilities/chat/providers/parallel.js";
import { PerplexityProvider } from "../capabilities/chat/providers/perplexity.js";
import { PollyProvider } from "../capabilities/chat/providers/polly.js";
import { PoolsideProvider } from "../capabilities/chat/providers/poolside.js";
import { RegoloProvider } from "../capabilities/chat/providers/regolo-ai.js";
import { ReplicateProvider } from "../capabilities/chat/providers/replicate.js";
import { RequestyProvider } from "../capabilities/chat/providers/requesty.js";
import { SakanaProvider } from "../capabilities/chat/providers/sakana.js";
import { StandardComputeProvider } from "../capabilities/chat/providers/standardcompute.js";
import { TheGridProvider } from "../capabilities/chat/providers/the-grid-ai.js";
import { ThinkingMachinesProvider } from "../capabilities/chat/providers/thinkingmachines.js";
import { TogetherAiProvider } from "../capabilities/chat/providers/together-ai.js";
import { UpstageProvider } from "../capabilities/chat/providers/upstage.js";
import { V0Provider } from "../capabilities/chat/providers/v0.js";
import { VercelGatewayProvider } from "../capabilities/chat/providers/vercel.js";
import { WorkersProvider } from "../capabilities/chat/providers/workers.js";
import { ZaiProvider } from "../capabilities/chat/providers/zai.js";
import type { AiProviderRegistration, AiProviderRegistry, ProviderRuntime } from "../runtime.js";

function chatProviders(runtime: ProviderRuntime): AiProviderRegistration<AIProvider>[] {
  return [
    {
      name: "anthropic",
      create: () => new AnthropicProvider(runtime),
      metadata: { vendor: "Anthropic", categories: ["chat"], tags: ["claude"] },
    },
    {
      name: "azure-openai",
      aliases: ["azure"],
      create: () => new AzureOpenAIProvider(runtime),
      metadata: { vendor: "Microsoft", categories: ["chat"], tags: ["azure"] },
    },
    {
      name: "bedrock",
      aliases: ["aws-bedrock"],
      create: () => new BedrockProvider(runtime),
      metadata: { vendor: "AWS", categories: ["chat"], tags: ["multi-provider"] },
    },
    {
      name: "bedrock-mantle",
      create: () => new BedrockMantleProvider(runtime),
      metadata: { vendor: "AWS", categories: ["chat"], tags: ["multi-provider"] },
    },
    {
      name: "nova",
      create: () => new AmazonNovaProvider(runtime),
      metadata: { vendor: "Amazon", categories: ["chat"] },
    },
    {
      name: "chutes",
      create: () => new ChutesProvider(runtime),
      metadata: { vendor: "Chutes", categories: ["chat"] },
    },
    {
      name: "cohere",
      create: () => new CohereProvider(runtime),
      metadata: { vendor: "Cohere", categories: ["chat"] },
    },
    {
      name: "deepinfra",
      create: () => new DeepInfraProvider(runtime),
      metadata: { vendor: "DeepInfra", categories: ["chat"] },
    },
    {
      name: "deepseek",
      create: () => new DeepSeekProvider(runtime),
      metadata: { vendor: "DeepSeek", categories: ["chat"] },
    },
    {
      name: "fireworks",
      create: () => new FireworksProvider(runtime),
      metadata: { vendor: "Fireworks AI", categories: ["chat"] },
    },
    {
      name: "github-copilot",
      create: () => new GithubCopilotProvider(runtime),
      metadata: { vendor: "GitHub", categories: ["chat"], tags: ["pairing"] },
    },
    {
      name: "google-ai-studio",
      aliases: ["google", "googleai"],
      create: () => new GoogleStudioProvider(runtime),
      metadata: { vendor: "Google", categories: ["chat"] },
    },
    {
      name: "grok",
      create: () => new GrokProvider(runtime),
      metadata: { vendor: "xAI", categories: ["chat"], tags: ["reasoning"] },
    },
    {
      name: "groq",
      create: () => new GroqProvider(runtime),
      metadata: { vendor: "Groq", categories: ["chat"], tags: ["fast"] },
    },
    {
      name: "huggingface",
      create: () => new HuggingFaceProvider(runtime),
      metadata: { vendor: "Hugging Face", categories: ["chat"] },
    },
    {
      name: "hyperbolic",
      create: () => new HyperbolicProvider(runtime),
      metadata: { vendor: "Hyperbolic", categories: ["chat"] },
    },
    {
      name: "inception",
      create: () => new InceptionProvider(runtime),
      metadata: { vendor: "Modal Labs", categories: ["chat"] },
    },
    {
      name: "inference",
      create: () => new InferenceProvider(runtime),
      metadata: { vendor: "Replicate", categories: ["chat"], tags: ["router"] },
    },
    {
      name: "mistral",
      create: () => new MistralProvider(runtime),
      metadata: { vendor: "Mistral AI", categories: ["chat"] },
    },
    {
      name: "morph",
      create: () => new MorphProvider(runtime),
      metadata: { vendor: "Morph", categories: ["chat"] },
    },
    {
      name: "openai",
      aliases: ["gpt"],
      create: () => new OpenAIProvider(runtime),
      metadata: { vendor: "OpenAI", categories: ["chat"] },
    },
    {
      name: "openrouter",
      create: () => new OpenRouterProvider(runtime),
      metadata: { vendor: "OpenRouter", categories: ["chat"], tags: ["meta"] },
    },
    {
      name: "parallel",
      create: () => new ParallelProvider(runtime),
      metadata: { vendor: "Parallel", categories: ["chat"] },
    },
    {
      name: "perplexity-ai",
      aliases: ["perplexity"],
      create: () => new PerplexityProvider(runtime),
      metadata: { vendor: "Perplexity", categories: ["chat", "search"] },
    },
    {
      name: "replicate",
      create: () => new ReplicateProvider(runtime),
      metadata: { vendor: "Replicate", categories: ["chat"] },
    },
    {
      name: "cartesia",
      aliases: ["certesia"],
      create: () => new CertesiaProvider(runtime),
      metadata: { vendor: "Cartesia", categories: ["chat", "audio"] },
    },
    {
      name: "cerebras",
      create: () => new CerebrasProvider(runtime),
      metadata: { vendor: "Cerebras", categories: ["chat", "audio"] },
    },
    {
      name: "elevenlabs",
      create: () => new ElevenLabsProvider(runtime),
      metadata: { vendor: "ElevenLabs", categories: ["chat", "audio"] },
    },
    {
      name: "polly",
      create: () => new PollyProvider(runtime),
      metadata: { vendor: "AWS", categories: ["chat", "audio"] },
    },
    {
      name: "requesty",
      create: () => new RequestyProvider(runtime),
      metadata: { vendor: "Requesty", categories: ["chat"] },
    },
    {
      name: "together-ai",
      aliases: ["together"],
      create: () => new TogetherAiProvider(runtime),
      metadata: { vendor: "Together AI", categories: ["chat"] },
    },
    {
      name: "upstage",
      create: () => new UpstageProvider(runtime),
      metadata: { vendor: "Upstage", categories: ["chat"] },
    },
    {
      name: "v0",
      create: () => new V0Provider(runtime),
      metadata: { vendor: "Vercel", categories: ["chat"] },
    },
    {
      name: "vercel",
      aliases: ["vercel-gateway"],
      create: () => new VercelGatewayProvider(runtime),
      metadata: { vendor: "Vercel", categories: ["chat"] },
    },
    {
      name: "workers",
      aliases: ["workers-ai"],
      create: () => new WorkersProvider(runtime),
      metadata: { vendor: "Cloudflare", categories: ["chat"] },
    },
    {
      name: "exa",
      create: () => new ExaProvider(runtime),
      metadata: { vendor: "Exa", categories: ["chat", "research"] },
    },
    {
      name: "fal",
      create: () => new FalAIProvider(runtime),
      metadata: { vendor: "Fal AI", categories: ["chat", "image", "video"] },
    },
    {
      name: "ideogram",
      create: () => new IdeogramProvider(runtime),
      metadata: { vendor: "Ideogram", categories: ["chat", "image"] },
    },
    {
      name: "opencode",
      create: () => new OpencodeProvider(runtime),
      metadata: { vendor: "OpenCode", categories: ["chat"] },
    },
    {
      name: "opencode-go",
      create: () => new OpencodeGoProvider(runtime),
      metadata: { vendor: "OpenCode Go", categories: ["chat"] },
    },
    {
      name: "cortecs",
      create: () => new CortecsProvider(runtime),
      metadata: { vendor: "Cortecs", categories: ["chat"] },
    },
    {
      name: "poolside",
      create: () => new PoolsideProvider(runtime),
      metadata: { vendor: "Poolside", categories: ["chat"], tags: ["coding"] },
    },
    {
      name: "hetzner",
      create: () => new HetznerProvider(runtime),
      metadata: { vendor: "Hetzner", categories: ["chat"], tags: ["free"] },
    },
    {
      name: "alibaba",
      aliases: ["dashscope", "qwen"],
      create: () => new AlibabaProvider(runtime),
      metadata: { vendor: "Alibaba", categories: ["chat"], tags: ["qwen"] },
    },
    {
      name: "zai",
      aliases: ["z-ai"],
      create: () => new ZaiProvider(runtime),
      metadata: { vendor: "Z.AI", categories: ["chat"], tags: ["glm"] },
    },
    {
      name: "moonshot",
      aliases: ["moonshotai", "kimi"],
      create: () => new MoonshotProvider(runtime),
      metadata: { vendor: "Moonshot AI", categories: ["chat"], tags: ["kimi"] },
    },
    {
      name: "minimax",
      create: () => new MiniMaxProvider(runtime),
      metadata: { vendor: "MiniMax", categories: ["chat"] },
    },
    {
      name: "google-vertex",
      aliases: ["vertex"],
      create: () => new GoogleVertexProvider(runtime),
      metadata: { vendor: "Google", categories: ["chat"] },
    },
    {
      name: "ollama-cloud",
      create: () => new OllamaCloudProvider(runtime),
      metadata: { vendor: "Ollama", categories: ["chat"] },
    },
    {
      name: "meta",
      create: () => new MetaProvider(runtime),
      metadata: { vendor: "Meta", categories: ["chat"], tags: ["muse"] },
    },
    {
      name: "greenpt",
      create: () => new GreenPtProvider(runtime),
      metadata: { vendor: "GreenPT", categories: ["chat"] },
    },
    {
      name: "lucidquery",
      create: () => new LucidQueryProvider(runtime),
      metadata: { vendor: "LucidQuery", categories: ["chat"] },
    },
    {
      name: "ovhcloud",
      aliases: ["ovh"],
      create: () => new OvhCloudProvider(runtime),
      metadata: { vendor: "OVHcloud", categories: ["chat"] },
    },
    {
      name: "regolo-ai",
      aliases: ["regolo"],
      create: () => new RegoloProvider(runtime),
      metadata: { vendor: "Regolo AI", categories: ["chat"] },
    },
    {
      name: "sakana",
      create: () => new SakanaProvider(runtime),
      metadata: { vendor: "Sakana AI", categories: ["chat"] },
    },
    {
      name: "standardcompute",
      create: () => new StandardComputeProvider(runtime),
      metadata: { vendor: "Standard Compute", categories: ["chat"] },
    },
    {
      name: "the-grid-ai",
      aliases: ["thegrid"],
      create: () => new TheGridProvider(runtime),
      metadata: { vendor: "The Grid AI", categories: ["chat"] },
    },
    {
      name: "kimi-for-coding",
      aliases: ["kimi-coding"],
      create: () => new KimiForCodingProvider(runtime),
      metadata: { vendor: "Moonshot AI", categories: ["chat"], tags: ["coding"] },
    },
    {
      name: "thinkingmachines",
      aliases: ["tinker"],
      create: () => new ThinkingMachinesProvider(runtime),
      metadata: { vendor: "Thinking Machines", categories: ["chat"] },
    },
  ];
}

export function registerChatProviders(
  registry: AiProviderRegistry,
  runtime: ProviderRuntime,
): void {
  for (const registration of chatProviders(runtime)) {
    registry.register("chat", registration);
  }
}
