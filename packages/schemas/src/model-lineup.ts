import z from "zod/v4";

import { MODEL_DEFAULTS, type ModelPolicyReference } from "./model-defaults";
import { isActiveModel, isStealthModel } from "./model-selection";
import type { ModelConfig, ModelConfigItem, ModelModality } from "./models";
import type { ReasoningEffort } from "./reasoning";

export const MODEL_TIERS = ["low", "medium", "high", "ultra"] as const;
export const modelTierSchema = z.enum(MODEL_TIERS);
export type ModelTier = z.infer<typeof modelTierSchema>;
export const DEFAULT_MODEL_TIER: ModelTier = "medium";

export const MODEL_LINEUP_RUNTIMES = ["hosted", "browser", "local-server"] as const;
export type ModelLineupRuntime = (typeof MODEL_LINEUP_RUNTIMES)[number];

export const MODEL_TIER_ROLES = ["agent", "coding"] as const;
export type ModelTierRole = (typeof MODEL_TIER_ROLES)[number];

export interface ModelLineupCandidate extends ModelPolicyReference {
  effort?: ReasoningEffort;
}

export interface ModelTierDefinition {
  id: ModelTier;
  label: string;
  tagline: string;
  description: string;
}

export const MODEL_TIER_DEFINITIONS: readonly ModelTierDefinition[] = [
  {
    id: "low",
    label: "Low",
    tagline: "Fast and cheap",
    description: "Small, well-defined tasks where speed and cost matter more than depth.",
  },
  {
    id: "medium",
    label: "Medium",
    tagline: "The everyday default",
    description: "Balances quality, speed and cost for most conversations and tasks.",
  },
  {
    id: "high",
    label: "High",
    tagline: "Deeper reasoning",
    description: "Difficult work that needs more reasoning and can tolerate more time and cost.",
  },
  {
    id: "ultra",
    label: "Ultra",
    tagline: "Maximum capability",
    description: "The hardest open-ended work, where capability matters more than speed or cost.",
  },
];

export const MODEL_TIER_ROLE_DEFINITIONS: Record<
  ModelTierRole,
  { label: string; description: string }
> = {
  agent: {
    label: "Agent",
    description: "Chat and Work conversations, recipes and channel replies.",
  },
  coding: {
    label: "Coding",
    description: "Sandbox coding runs in Work projects.",
  },
};

export const MODEL_LINEUP_RUNTIME_DEFINITIONS: Record<
  ModelLineupRuntime,
  { label: string; description: string }
> = {
  hosted: {
    label: "Hosted",
    description:
      "Models reached through Polychat or your own provider keys. The first model your plan can run wins.",
  },
  browser: {
    label: "In the browser",
    description: "WebLLM models that download once and run on your device. Nothing leaves it.",
  },
  "local-server": {
    label: "Local server",
    description: "Models served by Ollama or LM Studio on your own machine or network.",
  },
};

type TierLineup = Record<ModelTier, Record<ModelTierRole, readonly ModelLineupCandidate[]>>;

const hostedFreeAgent = {
  ultra: [
    { model: "z-ai/glm-5.2:free", provider: "openrouter", effort: "xhigh" },
    { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "high" },
    { model: "deepseek-v4-pro", provider: "deepseek", effort: "max" },
  ],
  high: [
    { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "high" },
    { model: "z-ai/glm-5.2:free", provider: "openrouter", effort: "high" },
    { model: "deepseek-v4-pro", provider: "deepseek", effort: "high" },
  ],
  medium: [
    { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "medium" },
    { model: "deepseek-v4-pro", provider: "deepseek", effort: "high" },
    { model: "minimax/minimax-m3:free", provider: "openrouter", effort: "thinking" },
  ],
  low: [
    { model: "deepseek-v4-flash", provider: "deepseek", effort: "low" },
    { model: "groq-openai-gpt-oss-120b", provider: "groq", effort: "low" },
    {
      model: "google-ai-studio/gemini-3.1-flash-lite",
      provider: "google-ai-studio",
      effort: "low",
    },
  ],
} satisfies Record<ModelTier, readonly ModelLineupCandidate[]>;

const hostedFreeCoding = {
  ultra: [
    { model: "z-ai/glm-5.2:free", provider: "openrouter", effort: "xhigh" },
    { model: "deepseek-v4-pro", provider: "deepseek", effort: "max" },
    { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "high" },
  ],
  high: [
    { model: "deepseek-v4-pro", provider: "deepseek", effort: "high" },
    { model: "z-ai/glm-5.2:free", provider: "openrouter", effort: "high" },
    { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "high" },
  ],
  medium: [
    { model: "deepseek-v4-pro", provider: "deepseek", effort: "high" },
    { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "medium" },
    { model: "minimax/minimax-m3:free", provider: "openrouter", effort: "thinking" },
  ],
  low: [
    { model: "deepseek-v4-flash", provider: "deepseek", effort: "low" },
    { model: "groq-openai-gpt-oss-120b", provider: "groq", effort: "low" },
    {
      model: "google-ai-studio/gemini-3.1-flash-lite",
      provider: "google-ai-studio",
      effort: "low",
    },
  ],
} satisfies Record<ModelTier, readonly ModelLineupCandidate[]>;

const HOSTED_LINEUP: TierLineup = {
  ultra: {
    agent: [
      { model: "claude-fable-5-1", provider: "anthropic", effort: "high" },
      { model: "anthropic/claude-fable-5.1", provider: "openrouter", effort: "high" },
      { model: "gpt-6-astra", provider: "openai", effort: "high" },
      { model: "openai/gpt-6-astra", provider: "openrouter", effort: "high" },
      { model: "moonshot/kimi-k3", provider: "moonshot", effort: "high" },
      { model: "moonshotai/kimi-k3", provider: "openrouter", effort: "high" },
      { model: "@cf/zai-org/glm-5.3", provider: "workers-ai", effort: "high" },
      ...hostedFreeAgent.ultra,
    ],
    coding: [
      { model: "claude-fable-5-1", provider: "anthropic", effort: "high" },
      { model: "anthropic/claude-fable-5.1", provider: "openrouter", effort: "high" },
      { model: "gpt-6-astra", provider: "openai", effort: "high" },
      { model: "openai/gpt-6-astra", provider: "openrouter", effort: "high" },
      { model: "moonshot/kimi-k3", provider: "moonshot", effort: "high" },
      { model: "moonshotai/kimi-k3", provider: "openrouter", effort: "high" },
      { model: "@cf/zai-org/glm-5.3", provider: "workers-ai", effort: "high" },
      ...hostedFreeCoding.ultra,
    ],
  },
  high: {
    agent: [
      { model: "claude-opus-5", provider: "anthropic", effort: "medium" },
      { model: "anthropic/claude-opus-5", provider: "openrouter", effort: "medium" },
      { model: "gpt-6-astra", provider: "openai", effort: "medium" },
      { model: "openai/gpt-6-astra", provider: "openrouter", effort: "medium" },
      { model: "@cf/zai-org/glm-5.3", provider: "workers-ai", effort: "high" },
      { model: "z-ai/glm-5.3", provider: "openrouter", effort: "high" },
      { model: "google-ai-studio/gemini-3.8-flash", provider: "google-ai-studio", effort: "high" },
      ...hostedFreeAgent.high,
    ],
    coding: [
      { model: "claude-opus-5", provider: "anthropic", effort: "medium" },
      { model: "anthropic/claude-opus-5", provider: "openrouter", effort: "medium" },
      { model: "gpt-6-astra", provider: "openai", effort: "medium" },
      { model: "openai/gpt-6-astra", provider: "openrouter", effort: "medium" },
      { model: "@cf/zai-org/glm-5.3", provider: "workers-ai", effort: "high" },
      { model: "z-ai/glm-5.3", provider: "openrouter", effort: "high" },
      ...hostedFreeCoding.high,
    ],
  },
  medium: {
    agent: [
      {
        model: "google-ai-studio/gemini-3.8-flash",
        provider: "google-ai-studio",
        effort: "medium",
      },
      { model: "google/gemini-3.8-flash", provider: "openrouter", effort: "medium" },
      { model: "gpt-5.6-sol", provider: "openai", effort: "medium" },
      { model: "openai/gpt-5.6-sol", provider: "openrouter", effort: "medium" },
      { model: "claude-sonnet-5", provider: "anthropic", effort: "medium" },
      { model: "@cf/zai-org/glm-5.3", provider: "workers-ai", effort: "medium" },
      ...hostedFreeAgent.medium,
    ],
    coding: [
      { model: "claude-sonnet-5", provider: "anthropic", effort: "medium" },
      { model: "anthropic/claude-sonnet-5", provider: "openrouter", effort: "medium" },
      { model: "gpt-5.6-sol", provider: "openai", effort: "medium" },
      { model: "openai/gpt-5.6-sol", provider: "openrouter", effort: "medium" },
      { model: "@cf/zai-org/glm-5.3", provider: "workers-ai", effort: "medium" },
      { model: "@cf/moonshotai/kimi-k2.7-code", provider: "workers-ai", effort: "medium" },
      ...hostedFreeCoding.medium,
    ],
  },
  low: {
    agent: [
      { model: "@cf/zai-org/glm-5.3-flash", provider: "workers-ai", effort: "thinking" },
      { model: "glm-5.3-flash", provider: "zai", effort: "low" },
      { model: "z-ai/glm-5.3-flash", provider: "openrouter", effort: "low" },
      { model: "gpt-5.6-luna", provider: "openai", effort: "low" },
      {
        model: "google-ai-studio/gemini-3.1-flash-lite",
        provider: "google-ai-studio",
        effort: "low",
      },
      ...hostedFreeAgent.low,
    ],
    coding: [
      { model: "@cf/zai-org/glm-5.3-flash", provider: "workers-ai", effort: "thinking" },
      { model: "glm-5.3-flash", provider: "zai", effort: "low" },
      { model: "z-ai/glm-5.3-flash", provider: "openrouter", effort: "low" },
      { model: "gpt-5.6-terra", provider: "openai", effort: "low" },
      ...hostedFreeCoding.low,
    ],
  },
};

const BROWSER_PROVIDER = "web-llm";

function browser(...models: string[]): ModelLineupCandidate[] {
  return models.map((model) => ({ model, provider: BROWSER_PROVIDER }));
}

const BROWSER_LINEUP: TierLineup = {
  ultra: {
    agent: browser("Qwen3.5-9B-q4f16_1-MLC", "Qwen3-8B-q4f16_1-MLC", "gemma-2-9b-it-q4f16_1-MLC"),
    coding: browser("Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC", "Qwen3.5-9B-q4f16_1-MLC"),
  },
  high: {
    agent: browser(
      "Qwen3-8B-q4f16_1-MLC",
      "Llama-3.1-8B-Instruct-q4f16_1-MLC",
      "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    ),
    coding: browser(
      "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
      "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    ),
  },
  medium: {
    agent: browser(
      "Qwen3.5-4B-q4f16_1-MLC",
      "Qwen3-4B-q4f16_1-MLC",
      "Phi-4-mini-instruct-q4f16_1-MLC",
    ),
    coding: browser(
      "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
      "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    ),
  },
  low: {
    agent: browser(
      "Qwen3.5-0.8B-q4f16_1-MLC",
      "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    ),
    coding: browser(
      "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
      "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",
    ),
  },
};

const LOCAL_SERVER_LINEUP: TierLineup = {
  ultra: {
    agent: [
      { model: "deepseek-v4-flash", provider: "ollama", effort: "thinking" },
      { model: "glm-5.1", provider: "ollama", effort: "thinking" },
      { model: "qwen3.5:397b", provider: "ollama", effort: "thinking" },
      { model: "kimi-k2.6", provider: "ollama", effort: "thinking" },
    ],
    coding: [
      { model: "deepseek-v4-pro", provider: "ollama", effort: "thinking" },
      { model: "qwen3-coder:480b", provider: "ollama" },
      { model: "devstral-2:123b", provider: "ollama" },
    ],
  },
  high: {
    agent: [
      { model: "gpt-oss:120b", provider: "ollama", effort: "thinking" },
      { model: "gemma4:31b", provider: "ollama", effort: "thinking" },
      { model: "nemotron-3-super", provider: "ollama", effort: "thinking" },
    ],
    coding: [
      { model: "devstral-2:123b", provider: "ollama" },
      { model: "qwen3-coder:480b", provider: "ollama" },
      { model: "qwen3-coder-next", provider: "ollama" },
    ],
  },
  medium: {
    agent: [
      { model: "gpt-oss:20b", provider: "ollama", effort: "thinking" },
      { model: "openai/gpt-oss-20b", provider: "lmstudio", effort: "medium" },
      { model: "gemma3:12b", provider: "ollama" },
    ],
    coding: [
      { model: "qwen3-coder-next", provider: "ollama" },
      { model: "devstral-small-2:24b", provider: "ollama" },
      { model: "qwen/qwen3-coder-30b", provider: "lmstudio" },
    ],
  },
  low: {
    agent: [
      { model: "ministral-3:8b", provider: "ollama" },
      { model: "gemma3:4b", provider: "ollama" },
      { model: "qwen/qwen3-30b-a3b-2507", provider: "lmstudio" },
    ],
    coding: [
      { model: "qwen/qwen3-coder-30b", provider: "lmstudio" },
      { model: "devstral-small-2:24b", provider: "ollama" },
      { model: "ministral-3:8b", provider: "ollama" },
    ],
  },
};

export const DEFAULT_SANDBOX_MODEL = hostedFreeCoding.medium[0].model;

export const MODEL_TIER_LINEUP: Record<ModelLineupRuntime, TierLineup> = {
  hosted: HOSTED_LINEUP,
  browser: BROWSER_LINEUP,
  "local-server": LOCAL_SERVER_LINEUP,
};

export const SYSTEM_MODEL_ROLES = [
  "titling",
  "compaction",
  "housekeeping",
  "retrieval",
  "guardrails",
  "transcription",
  "ocr",
  "image",
  "video",
  "music",
  "speech",
  "fim",
  "nextEdit",
  "applyEdit",
] as const;
export type SystemModelRole = (typeof SYSTEM_MODEL_ROLES)[number];

export interface SystemModelRoleDefinition {
  id: SystemModelRole;
  label: string;
  description: string;
  candidates: readonly ModelLineupCandidate[];
}

const platformHousekeeping: readonly ModelLineupCandidate[] = [
  { model: "@cf/zai-org/glm-5.3-flash", provider: "workers-ai" },
  { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "low" },
  { model: "deepseek-v4-flash", provider: "deepseek", effort: "low" },
  { model: "groq-openai-gpt-oss-120b", provider: "groq", effort: "low" },
  { model: "@cf/zai-org/glm-4.7-flash", provider: "workers-ai" },
];

export const SYSTEM_MODEL_LINEUP: readonly SystemModelRoleDefinition[] = [
  {
    id: "titling",
    label: "Titling",
    description: "Names conversations from their first exchange.",
    candidates: [
      { model: "@cf/zai-org/glm-5.3-flash", provider: "workers-ai" },
      { model: "groq-openai-gpt-oss-20b", provider: "groq", effort: "low" },
      {
        model: "google-ai-studio/gemini-3.1-flash-lite",
        provider: "google-ai-studio",
        effort: "minimal",
      },
      { model: "gpt-5.6-luna", provider: "openai", effort: "low" },
      { model: "@cf/zai-org/glm-4.7-flash", provider: "workers-ai" },
    ],
  },
  {
    id: "compaction",
    label: "Compaction",
    description: "Summarises older history when a conversation nears its context limit.",
    candidates: [
      { model: "@cf/zai-org/glm-5.3-flash", provider: "workers-ai" },
      { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "low" },
      { model: "deepseek-v4-flash", provider: "deepseek", effort: "low" },
      { model: "gpt-5.6-sol", provider: "openai", effort: "low" },
      { model: "@cf/zai-org/glm-4.7-flash", provider: "workers-ai" },
    ],
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    description: "Memory synthesis, notes, panels, search summaries and other background work.",
    candidates: platformHousekeeping,
  },
  {
    id: "retrieval",
    label: "Reading",
    description: "Article analysis, reports, summaries and content extraction.",
    candidates: [
      { model: "sonar", provider: "perplexity-ai" },
      { model: "google-ai-studio/gemini-3.5-flash", provider: "google-ai-studio", effort: "low" },
      { model: "@cf/zai-org/glm-5.3-flash", provider: "workers-ai" },
      { model: "groq-openai-gpt-oss-120b", provider: "groq", effort: "low" },
    ],
  },
  {
    id: "guardrails",
    label: "Guardrails",
    description: "Screens prompts and responses before they reach a person.",
    candidates: [
      { model: "openai/gpt-oss-safeguard-20b", provider: "groq" },
      { model: "@cf/meta/llama-guard-3-8b", provider: "workers-ai" },
    ],
  },
  {
    id: "transcription",
    label: "Dictation",
    description: "Turns recorded speech into text. Your transcription setting overrides this.",
    candidates: [
      { model: "whisper", provider: "workers-ai" },
      { model: "whisper-large-v3-turbo", provider: "groq" },
      { model: "gpt-4o-transcribe", provider: "openai" },
    ],
  },
  {
    id: "ocr",
    label: "Documents",
    description: "Reads scanned pages and images into text.",
    candidates: [MODEL_DEFAULTS.ocr],
  },
  {
    id: "image",
    label: "Painter",
    description: "Generates images for the image app and tools.",
    candidates: [MODEL_DEFAULTS.image.workersAi, MODEL_DEFAULTS.image.replicate],
  },
  {
    id: "video",
    label: "Video",
    description: "Generates short video clips.",
    candidates: [MODEL_DEFAULTS.video.replicate, MODEL_DEFAULTS.video.workersAi],
  },
  {
    id: "music",
    label: "Music",
    description: "Generates music and sound.",
    candidates: [MODEL_DEFAULTS.music.replicate, MODEL_DEFAULTS.music.workersAi],
  },
  {
    id: "speech",
    label: "Voice",
    description: "Reads responses aloud.",
    candidates: [MODEL_DEFAULTS.speech.workersAi, MODEL_DEFAULTS.speech.replicate],
  },
  {
    id: "fim",
    label: "Code completion",
    description: "Fill-in-the-middle completions for editors.",
    candidates: [
      { model: "mercury-coder", provider: "inception" },
      { model: "codestral", provider: "mistral" },
      { model: "mistral-large", provider: "mistral" },
    ],
  },
  {
    id: "nextEdit",
    label: "Next edit",
    description: "Predicts the next edit in a file.",
    candidates: [{ model: "mercury-coder", provider: "inception" }],
  },
  {
    id: "applyEdit",
    label: "Apply edit",
    description: "Merges a proposed edit into a file.",
    candidates: [{ model: "mercury-coder", provider: "inception" }],
  },
];

export function getSystemModelLineup(role: SystemModelRole): SystemModelRoleDefinition {
  const definition = SYSTEM_MODEL_LINEUP.find((entry) => entry.id === role);

  if (!definition) {
    throw new Error(`Unknown system model role: ${role}`);
  }

  return definition;
}

export function getModelTierDefinition(tier: ModelTier): ModelTierDefinition {
  return (
    MODEL_TIER_DEFINITIONS.find((definition) => definition.id === tier) ?? MODEL_TIER_DEFINITIONS[1]
  );
}

export function getModelTierCandidates(
  runtime: ModelLineupRuntime,
  tier: ModelTier,
  role: ModelTierRole,
): readonly ModelLineupCandidate[] {
  return MODEL_TIER_LINEUP[runtime][tier][role];
}

const NON_CHAT_STRENGTHS: ModelModality[] = [
  "embedding",
  "moderation",
  "speech",
  "voice-activity-detection",
  "guardrails",
  "reranking",
  "ocr",
  "transcription",
];

export function isLineupEligibleModel(model: ModelConfigItem) {
  return (
    isActiveModel(model) &&
    model.modalities?.input.includes("text") === true &&
    model.modalities.output?.length === 1 &&
    model.modalities.output[0] === "text" &&
    !model.supportsRealtimeSession &&
    !NON_CHAT_STRENGTHS.some((strength) => model.strengths?.includes(strength)) &&
    !isStealthModel(model)
  );
}

export interface ResolvedModelReference<T extends ModelConfigItem = ModelConfigItem> {
  id: string;
  config: T;
}

export function findModelByReference<T extends ModelConfigItem>(
  models: Record<string, T>,
  reference: ModelPolicyReference,
): ResolvedModelReference<T> | null {
  const directMatch = models[reference.model];

  if (directMatch?.provider === reference.provider) {
    return { id: reference.model, config: directMatch };
  }

  const matchingEntry = Object.entries(models).find(
    ([, model]) => model.provider === reference.provider && model.matchingModel === reference.model,
  );

  return matchingEntry ? { id: matchingEntry[0], config: matchingEntry[1] } : null;
}

export interface ResolvedLineupCandidate<
  T extends ModelConfigItem = ModelConfigItem,
> extends ResolvedModelReference<T> {
  candidate: ModelLineupCandidate;
  effort?: ReasoningEffort;
}

export interface ResolveLineupOptions<T extends ModelConfigItem> {
  isEligible?: (model: T) => boolean;
}

export function resolveLineupCandidates<T extends ModelConfigItem>(
  models: Record<string, T>,
  candidates: readonly ModelLineupCandidate[],
  options: ResolveLineupOptions<T> = {},
): ResolvedLineupCandidate<T>[] {
  const resolved: ResolvedLineupCandidate<T>[] = [];

  for (const candidate of candidates) {
    const match = findModelByReference(models, candidate);

    if (!match || (options.isEligible && !options.isEligible(match.config))) {
      continue;
    }

    resolved.push({
      ...match,
      candidate,
      effort: resolveLineupReasoningEffort(match.config, candidate.effort),
    });
  }

  return resolved;
}

export function resolveLineupCandidate<T extends ModelConfigItem>(
  models: Record<string, T>,
  candidates: readonly ModelLineupCandidate[],
  options: ResolveLineupOptions<T> = {},
): ResolvedLineupCandidate<T> | null {
  for (const candidate of candidates) {
    const match = findModelByReference(models, candidate);

    if (!match || (options.isEligible && !options.isEligible(match.config))) {
      continue;
    }

    return {
      ...match,
      candidate,
      effort: resolveLineupReasoningEffort(match.config, candidate.effort),
    };
  }

  return null;
}

const EFFORT_ORDER: readonly ReasoningEffort[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export function resolveLineupReasoningEffort(
  model: Pick<ModelConfigItem, "reasoningConfig">,
  effort: ReasoningEffort | undefined,
): ReasoningEffort | undefined {
  const supported = model.reasoningConfig?.supportedEffortLevels ?? [];

  if (!effort || supported.length === 0) {
    return undefined;
  }

  if (supported.includes(effort)) {
    return effort;
  }

  const requestedRank = EFFORT_ORDER.indexOf(effort);

  if (requestedRank === -1) {
    return supported.includes("thinking") ? "thinking" : undefined;
  }

  const ranked = supported
    .map((level) => ({ level, rank: EFFORT_ORDER.indexOf(level) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank);

  if (ranked.length === 0) {
    return supported.includes("thinking") ? "thinking" : undefined;
  }

  const closest = ranked.reduce((best, entry) =>
    Math.abs(entry.rank - requestedRank) < Math.abs(best.rank - requestedRank) ? entry : best,
  );

  return closest.level;
}

export function resolveModelTierSelection<T extends ModelConfigItem>(
  models: Record<string, T>,
  runtime: ModelLineupRuntime,
  tier: ModelTier,
  role: ModelTierRole,
  options: ResolveLineupOptions<T> = {},
): ResolvedLineupCandidate<T> | null {
  return resolveLineupCandidate(models, getModelTierCandidates(runtime, tier, role), options);
}

export function resolveModelTierAlternate<T extends ModelConfigItem>(
  models: Record<string, T>,
  runtime: ModelLineupRuntime,
  tier: ModelTier,
  role: ModelTierRole,
  primary: ResolvedLineupCandidate<T>,
  options: ResolveLineupOptions<T> = {},
): ResolvedLineupCandidate<T> | null {
  const resolved = resolveLineupCandidates(
    models,
    getModelTierCandidates(runtime, tier, role),
    options,
  );

  return (
    resolved.find(
      (entry) =>
        entry.id !== primary.id &&
        entry.config.provider !== primary.config.provider &&
        (entry.config.family ?? entry.config.matchingModel) !==
          (primary.config.family ?? primary.config.matchingModel),
    ) ?? null
  );
}

export function getLineupModelsByRuntime(models: ModelConfig, runtime: ModelLineupRuntime) {
  return Object.fromEntries(
    Object.entries(models).filter(([, model]) =>
      runtime === "browser"
        ? model.provider === BROWSER_PROVIDER
        : runtime === "local-server"
          ? model.provider === "ollama" || model.provider === "lmstudio"
          : model.provider !== BROWSER_PROVIDER,
    ),
  );
}
