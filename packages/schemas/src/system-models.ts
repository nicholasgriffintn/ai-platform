import z from "zod/v4";

import type { ModelLineupCandidate } from "./model-lineup.js";
import type { ModelModality } from "./models.js";
import { SPEECH_PROVIDERS } from "./speech-voices.js";

export const SYSTEM_MODEL_ROLES = [
  "titling",
  "compaction",
  "housekeeping",
  "retrieval",
  "writing",
  "routines",
  "vision",
  "guardrails",
  "decision",
  "extraction",
  "reranking",
  "transcription",
  "ocr",
  "image",
  "repaint",
  "video",
  "music",
  "speech",
  "liveDelegation",
  "fim",
  "nextEdit",
  "applyEdit",
] as const;
export const systemModelRoleSchema = z.enum(SYSTEM_MODEL_ROLES);
export type SystemModelRole = z.infer<typeof systemModelRoleSchema>;

export const SYSTEM_MODEL_ROLE_GROUPS = [
  { id: "writing", label: "Writing and summaries" },
  { id: "understanding", label: "Reading and listening" },
  { id: "judgement", label: "Checks and decisions" },
  { id: "media", label: "Pictures, sound and voice" },
  { id: "code", label: "Code editors" },
] as const;
export type SystemModelRoleGroup = (typeof SYSTEM_MODEL_ROLE_GROUPS)[number]["id"];

export const SYSTEM_MODEL_CAPABILITIES = [
  "supportsFim",
  "supportsNextEdit",
  "supportsApplyEdit",
] as const;
export type SystemModelCapability = (typeof SYSTEM_MODEL_CAPABILITIES)[number];

export type SystemModelRequirement =
  | { kind: "text"; inputs?: readonly ModelModality[]; providers?: readonly string[] }
  | {
      kind: "output";
      output: ModelModality;
      inputs?: readonly ModelModality[];
      strengths?: readonly ModelModality[];
      providers?: readonly string[];
    }
  | { kind: "capability"; capability: SystemModelCapability }
  | { kind: "anyOf"; options: readonly SystemModelRequirement[] };

export type SystemModelRanking =
  | { metric: "intelligence"; minContextWindow?: number }
  | { metric: "media"; key: string; lowerIsBetter?: boolean }
  | { metric: "cost" };

export interface SystemModelRoleDefinition {
  id: SystemModelRole;
  label: string;
  description: string;
  group: SystemModelRoleGroup;
  requires: SystemModelRequirement;
  ranking: SystemModelRanking;
  defaults: readonly ModelLineupCandidate[];
}

export const DOCUMENT_OCR_PROVIDERS = ["mistral", "greenpt"] as const;

export const TRANSCRIPTION_MODEL_PROVIDERS = [
  "workers-ai",
  "mistral",
  "replicate",
  "greenpt",
] as const;

const workersAi = (model: string, effort?: ModelLineupCandidate["effort"]) => ({
  model,
  provider: "workers-ai",
  ...(effort ? { effort } : {}),
});

export const SYSTEM_MODEL_LINEUP: readonly SystemModelRoleDefinition[] = [
  {
    id: "titling",
    label: "Titling",
    description: "Names conversations from their first exchange.",
    group: "writing",
    requires: { kind: "text" },
    ranking: { metric: "cost" },
    defaults: [
      workersAi("@cf/zai-org/glm-4.7-flash", "low"),
      workersAi("@cf/google/gemma-4-26b-a4b-it"),
    ],
  },
  {
    id: "compaction",
    label: "Compaction",
    description: "Summarises older history when a conversation nears its context limit.",
    group: "writing",
    requires: { kind: "text" },
    ranking: { metric: "intelligence", minContextWindow: 200_000 },
    defaults: [
      workersAi("@cf/zai-org/glm-5.3-flash"),
      workersAi("@cf/deepseek-ai/deepseek-v4.1-flash-1017"),
      workersAi("@cf/google/gemma-4-26b-a4b-it"),
    ],
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    description:
      "Memory, notes, document tidying, classification and other background work that never reaches a reply.",
    group: "writing",
    requires: { kind: "text" },
    ranking: { metric: "cost" },
    defaults: [
      workersAi("@cf/zai-org/glm-4.7-flash", "low"),
      workersAi("@cf/google/gemma-4-26b-a4b-it"),
    ],
  },
  {
    id: "retrieval",
    label: "Reading",
    description: "Summarises pages, articles and search results pulled in by tools.",
    group: "writing",
    requires: { kind: "text" },
    ranking: { metric: "intelligence", minContextWindow: 200_000 },
    defaults: [
      workersAi("@cf/zai-org/glm-5.3-flash"),
      workersAi("@cf/deepseek-ai/deepseek-v4.1-flash-1017"),
      workersAi("@cf/google/gemma-4-26b-a4b-it"),
    ],
  },
  {
    id: "writing",
    label: "Writing",
    description:
      "Longer pieces written for you: Discover editions and episodes, notebook drafts, podcast scripts and framing.",
    group: "writing",
    requires: { kind: "text" },
    ranking: { metric: "intelligence" },
    defaults: [workersAi("@cf/moonshotai/kimi-k2.6"), workersAi("@cf/zai-org/glm-5.3")],
  },
  {
    id: "routines",
    label: "Teammates and routines",
    description:
      "Teammates without a model of their own, and routines that run on a schedule or an event: delegations, wakes, channel replies and recipes.",
    group: "writing",
    requires: { kind: "text" },
    ranking: { metric: "intelligence" },
    defaults: [workersAi("@cf/zai-org/glm-5.3-flash"), workersAi("@cf/moonshotai/kimi-k2.6")],
  },
  {
    id: "vision",
    label: "Looking",
    description: "Describes pictures and sketches, such as guessing what a drawing shows.",
    group: "understanding",
    requires: { kind: "text", inputs: ["image"] },
    ranking: { metric: "intelligence" },
    defaults: [workersAi("@cf/zai-org/glm-5.3-flash"), workersAi("@cf/google/gemma-4-26b-a4b-it")],
  },
  {
    id: "transcription",
    label: "Dictation",
    description: "Turns recorded speech into text.",
    group: "understanding",
    requires: {
      kind: "output",
      output: "text",
      inputs: ["audio"],
      strengths: ["transcription"],
      providers: TRANSCRIPTION_MODEL_PROVIDERS,
    },
    ranking: { metric: "media", key: "aaWerIndex", lowerIsBetter: true },
    defaults: [workersAi("@cf/openai/whisper-large-v3-turbo"), workersAi("@cf/deepgram/nova-3")],
  },
  {
    id: "ocr",
    label: "Documents",
    description:
      "Reads scanned pages and images into text. Vision models read images only; PDFs need a dedicated document model.",
    group: "understanding",
    requires: {
      kind: "anyOf",
      options: [
        {
          kind: "output",
          output: "text",
          inputs: ["image"],
          strengths: ["ocr"],
          providers: DOCUMENT_OCR_PROVIDERS,
        },
        { kind: "text", inputs: ["image"], providers: ["workers-ai"] },
      ],
    },
    ranking: { metric: "cost" },
    defaults: [workersAi("@cf/google/gemma-4-26b-a4b-it")],
  },
  {
    id: "extraction",
    label: "Extraction",
    description:
      "Typed values pulled from text and images: amounts, dates, spans, estimates and forecasts with confidence.",
    group: "understanding",
    requires: { kind: "output", output: "extraction" },
    ranking: { metric: "cost" },
    defaults: [workersAi("@cf/cloudflare/clairic")],
  },
  {
    id: "reranking",
    label: "Reranking",
    description: "Reorders retrieved candidates by their relevance to the current query.",
    group: "understanding",
    requires: { kind: "output", output: "reranking" },
    ranking: { metric: "cost" },
    defaults: [workersAi("@cf/baai/bge-reranker-base")],
  },
  {
    id: "guardrails",
    label: "Guardrails",
    description:
      "Screens prompts and responses before they reach a person. Safety classifiers such as Llama Guard, TypeSafe's Jev, GreenPT's Metis and Mistral moderation all qualify.",
    group: "judgement",
    requires: {
      kind: "anyOf",
      options: [
        { kind: "output", output: "guardrails" },
        { kind: "output", output: "decision", providers: ["typesafe", "greenpt"] },
        { kind: "output", output: "moderation", providers: ["mistral"] },
      ],
    },
    ranking: { metric: "cost" },
    defaults: [workersAi("@cf/meta/llama-guard-3-8b")],
  },
  {
    id: "decision",
    label: "Decisions",
    description:
      "Fast calibrated judgements: yes/no checks, classifications and ratings that gate other work.",
    group: "judgement",
    requires: { kind: "output", output: "decision" },
    ranking: { metric: "cost" },
    defaults: [
      workersAi("@cf/cloudflare/clef-flash"),
      workersAi("@cf/cloudflare/clef-omni"),
      workersAi("@cf/cloudflare/clef"),
    ],
  },
  {
    id: "image",
    label: "Painter",
    description: "Draws pictures for the image app, tools, covers and Discover.",
    group: "media",
    requires: { kind: "output", output: "image", inputs: ["text"] },
    ranking: { metric: "media", key: "text_to_imageElo" },
    defaults: [
      workersAi("@cf/black-forest-labs/flux-2-dev"),
      workersAi("@cf/black-forest-labs/flux-2-klein-4b"),
    ],
  },
  {
    id: "repaint",
    label: "Repaint",
    description: "Turns a sketch into a finished painting by editing the picture you drew.",
    group: "media",
    requires: { kind: "output", output: "image", inputs: ["image"], providers: ["workers-ai"] },
    ranking: { metric: "media", key: "image_editingElo" },
    defaults: [
      workersAi("@cf/black-forest-labs/flux-2-klein-4b"),
      workersAi("@cf/black-forest-labs/flux-2-klein-9b"),
    ],
  },
  {
    id: "video",
    label: "Video",
    description: "Generates short video clips.",
    group: "media",
    requires: { kind: "output", output: "video" },
    ranking: { metric: "media", key: "text_to_videoElo" },
    defaults: [workersAi("google/veo-3.1-fast")],
  },
  {
    id: "music",
    label: "Music",
    description: "Generates music and sound.",
    group: "media",
    requires: { kind: "output", output: "audio" },
    ranking: { metric: "media", key: "music_with_vocalsElo" },
    defaults: [workersAi("minimax/music-2.6")],
  },
  {
    id: "speech",
    label: "Voice",
    description: "Reads responses aloud, narrates and voices podcasts.",
    group: "media",
    requires: { kind: "output", output: "speech", inputs: ["text"], providers: SPEECH_PROVIDERS },
    ranking: { metric: "media", key: "text_to_speechElo" },
    defaults: [
      workersAi("@cf/deepgram/aura-2-en"),
      workersAi("@cf/deepgram/aura-1"),
      workersAi("@cf/myshell-ai/melotts"),
    ],
  },
  {
    id: "liveDelegation",
    label: "Live voice hand-offs",
    description:
      "The OpenAI model GPT-Live hands harder questions to during a live voice session. Without a choice, the best value OpenAI model you can use.",
    group: "media",
    requires: { kind: "text", providers: ["openai"] },
    ranking: { metric: "intelligence" },
    defaults: [],
  },
  {
    id: "fim",
    label: "Code completion",
    description: "Fill-in-the-middle completions for editors.",
    group: "code",
    requires: { kind: "capability", capability: "supportsFim" },
    ranking: { metric: "cost" },
    defaults: [],
  },
  {
    id: "nextEdit",
    label: "Next edit",
    description: "Predicts the next edit in a file.",
    group: "code",
    requires: { kind: "capability", capability: "supportsNextEdit" },
    ranking: { metric: "cost" },
    defaults: [],
  },
  {
    id: "applyEdit",
    label: "Apply edit",
    description: "Merges a proposed edit into a file.",
    group: "code",
    requires: { kind: "capability", capability: "supportsApplyEdit" },
    ranking: { metric: "cost" },
    defaults: [],
  },
];

export const SYSTEM_MODEL_CHOICE_LIMIT = 4;

export const systemModelChoiceSchema = z.object({
  model: z.string().min(1),
  provider: z.string().min(1),
});
export type SystemModelChoice = z.infer<typeof systemModelChoiceSchema>;

export const systemModelChoicesSchema = z.partialRecord(
  systemModelRoleSchema,
  z.array(systemModelChoiceSchema).max(SYSTEM_MODEL_CHOICE_LIMIT),
);
export type SystemModelChoices = z.infer<typeof systemModelChoicesSchema>;

export const SYSTEM_MODEL_CHOICE_SCOPES = ["user", "workspace"] as const;
export const systemModelChoiceScopeSchema = z.enum(SYSTEM_MODEL_CHOICE_SCOPES);
export type SystemModelChoiceScope = z.infer<typeof systemModelChoiceScopeSchema>;

export const SYSTEM_MODEL_CHOICE_STATUSES = ["ready", "unavailable", "retired"] as const;
export const systemModelChoiceStatusSchema = z.enum(SYSTEM_MODEL_CHOICE_STATUSES);
export type SystemModelChoiceStatus = z.infer<typeof systemModelChoiceStatusSchema>;

export const systemModelChoiceViewSchema = systemModelChoiceSchema.extend({
  id: z.string().nullable(),
  status: systemModelChoiceStatusSchema,
});
export type SystemModelChoiceView = z.infer<typeof systemModelChoiceViewSchema>;

export const systemModelOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  avatarUrl: z.string().optional(),
});
export type SystemModelOption = z.infer<typeof systemModelOptionSchema>;

export const systemModelActiveSourceSchema = z.enum(["workspace", "user", "platform"]);
export type SystemModelActiveSource = z.infer<typeof systemModelActiveSourceSchema>;

export const systemModelRoleViewSchema = z.object({
  role: systemModelRoleSchema,
  choices: z.array(systemModelChoiceViewSchema),
  defaults: z.array(systemModelChoiceViewSchema),
  options: z.array(z.string()),
  active: z
    .object({
      id: z.string(),
      source: systemModelActiveSourceSchema,
    })
    .nullable(),
});
export type SystemModelRoleView = z.infer<typeof systemModelRoleViewSchema>;

export const systemModelChoicesQuerySchema = z.object({
  workspace_id: z.string().min(1).optional(),
});

export const systemModelChoicesResponseSchema = z.object({
  scope: systemModelChoiceScopeSchema,
  editable: z.boolean(),
  models: z.record(z.string(), systemModelOptionSchema),
  roles: z.array(systemModelRoleViewSchema),
});
export type SystemModelChoicesResponse = z.infer<typeof systemModelChoicesResponseSchema>;

export const updateSystemModelChoicesSchema = z.object({
  workspace_id: z.string().min(1).optional(),
  choices: systemModelChoicesSchema,
});
export type UpdateSystemModelChoicesInput = z.infer<typeof updateSystemModelChoicesSchema>;

export const SYSTEM_MODEL_PRIORITIES = ["quality", "value"] as const;
export const systemModelPrioritySchema = z.enum(SYSTEM_MODEL_PRIORITIES);
export type SystemModelPriority = z.infer<typeof systemModelPrioritySchema>;

export const suggestSystemModelChoicesSchema = z.object({
  workspace_id: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  priority: systemModelPrioritySchema.default("value"),
});
export type SuggestSystemModelChoicesInput = z.infer<typeof suggestSystemModelChoicesSchema>;

export const systemModelSuggestionsResponseSchema = z.object({
  providers: z.array(z.string()),
  suggestions: z.array(
    z.object({
      role: systemModelRoleSchema,
      choices: z.array(systemModelChoiceSchema),
    }),
  ),
});
export type SystemModelSuggestionsResponse = z.infer<typeof systemModelSuggestionsResponseSchema>;

export function getSystemModelLineup(role: SystemModelRole): SystemModelRoleDefinition {
  const definition = SYSTEM_MODEL_LINEUP.find((entry) => entry.id === role);

  if (!definition) {
    throw new Error(`Unknown system model role: ${role}`);
  }

  return definition;
}
