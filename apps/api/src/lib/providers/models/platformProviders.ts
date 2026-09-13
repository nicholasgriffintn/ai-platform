import type { IEnv } from "~/types";

type EnvLike = Pick<IEnv, keyof IEnv> | Record<string, unknown>;

function hasEnvValue(env: EnvLike, key: string): boolean {
  const value = (env as Record<string, unknown>)[key];

  return typeof value === "string" && value.trim().length > 0;
}

type EnvKeyGroups = string[][];

const EMPTY_GROUPS: EnvKeyGroups = [];

function single(key: string): EnvKeyGroups {
  return [[key]];
}

const PROVIDER_PLATFORM_ENV_KEYS: Record<string, EnvKeyGroups> = {
  alibaba: single("DASHSCOPE_API_KEY"),
  dashscope: single("DASHSCOPE_API_KEY"),
  qwen: single("DASHSCOPE_API_KEY"),
  anthropic: single("ANTHROPIC_API_KEY"),
  "azure-openai": single("AZURE_API_KEY"),
  azure: single("AZURE_API_KEY"),
  bedrock: [["BEDROCK_AWS_ACCESS_KEY", "BEDROCK_AWS_SECRET_KEY"]],
  "aws-bedrock": [["BEDROCK_AWS_ACCESS_KEY", "BEDROCK_AWS_SECRET_KEY"]],
  nova: single("AMAZON_NOVA_API_KEY"),
  cartesia: single("CARTESIA_API_KEY"),
  certesia: single("CARTESIA_API_KEY"),
  cerebras: single("CEREBRAS_API_KEY"),
  chutes: single("CHUTES_API_KEY"),
  cohere: single("COHERE_API_KEY"),
  cortecs: single("CORTECS_API_KEY"),
  deepinfra: single("DEEPINFRA_API_KEY"),
  deepseek: single("DEEPSEEK_API_KEY"),
  elevenlabs: single("ELEVENLABS_API_KEY"),
  exa: single("EXA_API_KEY"),
  fal: single("FAL_KEY"),
  fireworks: single("FIREWORKS_API_KEY"),
  "github-models": single("GITHUB_MODELS_API_TOKEN"),
  github: single("GITHUB_MODELS_API_TOKEN"),
  "github-copilot": single("GITHUB_COPILOT_TOKEN"),
  "google-ai-studio": single("GOOGLE_STUDIO_API_KEY"),
  google: single("GOOGLE_STUDIO_API_KEY"),
  googleai: single("GOOGLE_STUDIO_API_KEY"),
  "google-vertex": single("GOOGLE_VERTEX_API_KEY"),
  vertex: single("GOOGLE_VERTEX_API_KEY"),
  greenpt: single("GREENPT_API_KEY"),
  grok: single("GROK_API_KEY"),
  groq: single("GROQ_API_KEY"),
  hetzner: single("HETZNER_API_KEY"),
  huggingface: single("HUGGINGFACE_TOKEN"),
  hyperbolic: single("HYPERBOLIC_API_KEY"),
  ideogram: single("IDEOGRAM_API_KEY"),
  inception: single("INCEPTION_API_KEY"),
  inference: single("INFERENCE_API_KEY"),
  "kimi-for-coding": single("KIMI_API_KEY"),
  "kimi-coding": single("KIMI_API_KEY"),
  lucidquery: single("LUCIDQUERY_API_KEY"),
  meta: single("META_MODEL_API_KEY"),
  minimax: single("MINIMAX_API_KEY"),
  mistral: single("MISTRAL_API_KEY"),
  moonshot: single("MOONSHOT_API_KEY"),
  moonshotai: single("MOONSHOT_API_KEY"),
  kimi: single("MOONSHOT_API_KEY"),
  morph: single("MORPH_API_KEY"),
  "ollama-cloud": single("OLLAMA_CLOUD_API_KEY"),
  openai: single("OPENAI_API_KEY"),
  gpt: single("OPENAI_API_KEY"),
  opencode: single("opencode_API_KEY"),
  "opencode-go": single("OPENCODE_GO_API_KEY"),
  openrouter: single("OPENROUTER_API_KEY"),
  ovhcloud: single("OVHCLOUD_API_KEY"),
  ovh: single("OVHCLOUD_API_KEY"),
  parallel: single("PARALLEL_API_KEY"),
  "perplexity-ai": single("PERPLEXITY_API_KEY"),
  perplexity: single("PERPLEXITY_API_KEY"),
  polly: [
    ["POLLY_ACCESS_KEY_ID", "POLLY_SECRET_ACCESS_KEY"],
    ["BEDROCK_AWS_ACCESS_KEY", "BEDROCK_AWS_SECRET_KEY"],
  ],
  "polychat-sandbox": EMPTY_GROUPS,
  poolside: single("POOLSIDE_API_KEY"),
  "regolo-ai": single("REGOLO_API_KEY"),
  regolo: single("REGOLO_API_KEY"),
  replicate: single("REPLICATE_API_TOKEN"),
  requesty: single("REQUESTY_API_KEY"),
  sagemaker: [["SAGEMAKER_AWS_ACCESS_KEY", "SAGEMAKER_AWS_SECRET_KEY"]],
  "aws-sagemaker-runtime": [["SAGEMAKER_AWS_ACCESS_KEY", "SAGEMAKER_AWS_SECRET_KEY"]],
  sakana: single("SAKANA_API_KEY"),
  standardcompute: single("STANDARDCOMPUTE_API_KEY"),
  "the-grid-ai": single("THEGRID_API_KEY"),
  thegrid: single("THEGRID_API_KEY"),
  thinkingmachines: single("TINKER_API_KEY"),
  tinker: single("TINKER_API_KEY"),
  "together-ai": single("TOGETHER_AI_API_KEY"),
  together: single("TOGETHER_AI_API_KEY"),
  upstage: single("UPSTAGE_API_KEY"),
  v0: single("V0_API_KEY"),
  vercel: single("VERCEL_AI_GATEWAY_API_KEY"),
  "vercel-gateway": single("VERCEL_AI_GATEWAY_API_KEY"),
  workers: EMPTY_GROUPS,
  "workers-ai": EMPTY_GROUPS,
  zai: single("ZAI_API_KEY"),
  "z-ai": single("ZAI_API_KEY"),
};

export function getProviderPlatformEnvKeys(providerId: string): EnvKeyGroups | undefined {
  return PROVIDER_PLATFORM_ENV_KEYS[providerId];
}

export function isProviderPlatformEnabled(providerId: string, env: EnvLike): boolean {
  const groups = PROVIDER_PLATFORM_ENV_KEYS[providerId];

  if (!groups) {
    return false;
  }

  if (groups.length === 0) {
    return true;
  }

  return groups.some((keys) => keys.every((key) => hasEnvValue(env, key)));
}

export function getPlatformEnabledProviders(env: EnvLike): Set<string> {
  const enabled = new Set<string>();

  for (const providerId of Object.keys(PROVIDER_PLATFORM_ENV_KEYS)) {
    if (isProviderPlatformEnabled(providerId, env)) {
      enabled.add(providerId);
    }
  }

  return enabled;
}
