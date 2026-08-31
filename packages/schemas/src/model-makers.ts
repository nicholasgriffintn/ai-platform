export interface ModelMaker {
  id: string;
  label: string;
  providers: readonly string[];
  families: readonly string[];
}

export const MODEL_MAKERS: readonly ModelMaker[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    providers: ["anthropic"],
    families: ["claude"],
  },
  {
    id: "openai",
    label: "OpenAI",
    providers: ["openai", "azure-openai"],
    families: ["gpt", "o", "codex", "whisper", "text-embedding", "tts", "dall-e", "sora"],
  },
  {
    id: "google",
    label: "Google",
    providers: ["google-ai-studio", "google-vertex"],
    families: ["gemini", "gemma", "imagen", "veo", "lyria"],
  },
  {
    id: "meta",
    label: "Meta",
    providers: ["meta"],
    families: ["llama", "code-llama", "muse"],
  },
  {
    id: "xai",
    label: "xAI",
    providers: ["grok", "xai"],
    families: ["grok"],
  },
  {
    id: "mistral",
    label: "Mistral",
    providers: ["mistral"],
    families: [
      "mistral",
      "ministral",
      "magistral",
      "mixtral",
      "codestral",
      "devstral",
      "pixtral",
      "voxtral",
      "leanstral",
    ],
  },
  {
    id: "qwen",
    label: "Qwen",
    providers: ["alibaba", "dashscope"],
    families: ["qwen", "qvq", "wan"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    providers: ["deepseek"],
    families: ["deepseek"],
  },
  {
    id: "zai",
    label: "Z.ai",
    providers: ["zai"],
    families: ["glm"],
  },
  {
    id: "moonshot",
    label: "Moonshot AI",
    providers: ["moonshot", "kimi-for-coding"],
    families: ["kimi"],
  },
  {
    id: "minimax",
    label: "MiniMax",
    providers: ["minimax"],
    families: ["minimax"],
  },
  {
    id: "amazon",
    label: "Amazon",
    providers: ["nova"],
    families: ["nova", "titan"],
  },
  {
    id: "microsoft",
    label: "Microsoft",
    providers: [],
    families: ["phi", "mai"],
  },
  {
    id: "nvidia",
    label: "NVIDIA",
    providers: ["nvidia"],
    families: ["nemotron", "cosmos"],
  },
  {
    id: "cohere",
    label: "Cohere",
    providers: ["cohere"],
    families: ["command", "cohere-embed", "north", "rerank"],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    providers: ["perplexity-ai", "perplexity"],
    families: ["sonar"],
  },
  {
    id: "ai21",
    label: "AI21 Labs",
    providers: [],
    families: ["jamba"],
  },
  {
    id: "upstage",
    label: "Upstage",
    providers: ["upstage"],
    families: ["solar"],
  },
  {
    id: "inception",
    label: "Inception",
    providers: ["inception"],
    families: ["mercury"],
  },
  {
    id: "poolside",
    label: "Poolside",
    providers: ["poolside"],
    families: ["laguna"],
  },
  {
    id: "nous-research",
    label: "Nous Research",
    providers: [],
    families: ["hermes"],
  },
  {
    id: "bytedance",
    label: "ByteDance",
    providers: [],
    families: ["seed"],
  },
  {
    id: "xiaomi",
    label: "Xiaomi",
    providers: [],
    families: ["mimo"],
  },
  {
    id: "tencent",
    label: "Tencent",
    providers: [],
    families: ["hunyuan", "hy"],
  },
  {
    id: "inclusion-ai",
    label: "Inclusion AI",
    providers: [],
    families: ["ling", "ring"],
  },
  {
    id: "stepfun",
    label: "StepFun",
    providers: [],
    families: ["step"],
  },
  {
    id: "writer",
    label: "Writer",
    providers: [],
    families: ["palmyra"],
  },
  {
    id: "black-forest-labs",
    label: "Black Forest Labs",
    providers: [],
    families: ["flux"],
  },
  {
    id: "ideogram",
    label: "Ideogram",
    providers: ["ideogram"],
    families: ["ideogram"],
  },
  {
    id: "recraft",
    label: "Recraft",
    providers: [],
    families: ["recraft"],
  },
  {
    id: "morph",
    label: "Morph",
    providers: ["morph"],
    families: ["morph"],
  },
  {
    id: "sakana",
    label: "Sakana AI",
    providers: ["sakana"],
    families: ["sakana"],
  },
  {
    id: "thinking-machines",
    label: "Thinking Machines",
    providers: ["thinkingmachines"],
    families: ["inkling"],
  },
  {
    id: "vercel",
    label: "Vercel",
    providers: ["v0", "vercel"],
    families: ["v0"],
  },
  {
    id: "longcat",
    label: "LongCat",
    providers: [],
    families: ["longcat"],
  },
  {
    id: "kwaipilot",
    label: "Kwaipilot",
    providers: [],
    families: ["kat-coder"],
  },
  {
    id: "baidu",
    label: "Baidu",
    providers: [],
    families: ["ernie"],
  },
];

const MAKERS_BY_ID = new Map(MODEL_MAKERS.map((maker) => [maker.id, maker]));

function normalise(value: string | null | undefined): string | undefined {
  const normalised = value?.trim().toLowerCase();

  return normalised || undefined;
}

function familyBelongsTo(family: string, declared: string): boolean {
  if (family === declared) {
    return true;
  }

  return family.startsWith(declared) && !/[a-z]/.test(family.charAt(declared.length));
}

export function findModelMaker(id: string | null | undefined): ModelMaker | undefined {
  const normalised = normalise(id);

  return normalised ? MAKERS_BY_ID.get(normalised) : undefined;
}

export function resolveModelMakerId(
  model: { family?: string | null; provider?: string | null } | null | undefined,
): string | undefined {
  const family = normalise(model?.family);
  const provider = normalise(model?.provider);

  if (family) {
    const byFamily = MODEL_MAKERS.find((maker) =>
      maker.families.some((declared) => familyBelongsTo(family, declared)),
    );

    if (byFamily) {
      return byFamily.id;
    }
  }

  if (provider) {
    return MODEL_MAKERS.find((maker) => maker.providers.includes(provider))?.id;
  }

  return undefined;
}
