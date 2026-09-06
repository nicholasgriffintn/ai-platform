import type {
  AppIosDecision,
  AppScope,
  AppTheme,
  ProjectExperienceDefinition,
  ProjectExperienceRuntime,
  ModelToolDefinition,
} from "@ngriffin_uk/polychat-schemas";

export type AppKind = "dynamic" | "frontend";

/**
 * One entry per rich experience. Entries with a `capabilityId` are also published as apps a
 * project or person can enable; entries without one are always available alongside them.
 */
export interface ExperienceDefinition {
  id: string;
  runtime: ProjectExperienceRuntime;
  name: string;
  description: string;
  when: string;
  uses: string;
  produces: string;
  ios: AppIosDecision;
  scope?: AppScope;
  scopeReason?: string;
  category: string;
  icon?: string;
  theme?: AppTheme;
  tags?: string[];
  type?: "normal" | "premium" | "byok";
  capabilityId?: string;
}

export const EXPERIENCES: ExperienceDefinition[] = [
  {
    id: "strudel",
    runtime: "strudel",
    capabilityId: "featured-strudel",
    name: "Strudel Music Patterns",
    category: "Creative",
    when: "You want a playable music pattern rather than a rendered audio file.",
    uses: "A description of the sound, or a pattern you already have.",
    produces: "A Strudel pattern you can play, edit and hand back into a conversation.",
    ios: "results-only",
    description:
      "Create and generate music patterns with AI using Strudel's powerful code-based music creation tool",
    icon: "music",
    theme: "indigo",
    tags: ["music", "audio", "generation"],
    type: "normal",
  },
  {
    id: "image-studio",
    runtime: "image-studio",
    capabilityId: "featured-image-studio",
    name: "Image Studio",
    category: "Creative",
    when: "You want to make or refine an image and compare a few attempts.",
    uses: "A description, and any reference image or sketch you give it.",
    produces: "Images kept as results you can attach back into a conversation.",
    ios: "results-only",
    description:
      "Generate images across models, sketch a starting point, and keep the versions worth keeping",
    icon: "image",
    theme: "rose",
    tags: ["image", "generation", "sketch"],
    type: "premium",
  },
  {
    id: "replicate",
    runtime: "replicate",
    capabilityId: "featured-replicate",
    name: "Replicate Predictions",
    category: "Creative",
    when: "A model on Replicate does the job better than anything built in.",
    uses: "Your own Replicate key and a model from their catalogue.",
    produces: "Images, video or audio kept as durable results.",
    ios: "results-only",
    description: "Generate images, videos, audio, and more with state-of-the-art AI models",
    icon: "sparkles",
    theme: "violet",
    tags: ["media", "multi-modal", "generation"],
    type: "byok",
  },
  {
    id: "finetuning",
    runtime: "finetuning",
    capabilityId: "featured-finetuning",
    name: "Training",
    category: "Engineering",
    when: "You are training or deploying a model, not using one.",
    uses: "Examples you have gathered and a provider that supports training.",
    produces: "A trained model and its deployment, with the job visible in Attention.",
    ios: "web-only",
    scope: "personal",
    scopeReason:
      "Training runs on your own provider credentials and deploys to your own account, so it stays with you rather than with a project.",
    description: "Train, inspect, and deploy provider-backed models from the API model catalogue",
    icon: "hammer",
    theme: "slate",
    tags: ["training", "models", "deployments"],
    type: "premium",
  },
  {
    id: "recordings",
    runtime: "recordings",
    capabilityId: "featured-recording-processor",
    name: "Recording Processor",
    category: "Research",
    when: "You need to know what was said in something you recorded.",
    uses: "An audio recording you have uploaded, and how many people speak in it.",
    produces: "A transcript, a summary and a cover image, all kept as results.",
    ios: "results-only",
    description: "Upload and process your recording to get transcription, summary, and cover image",
    icon: "mic",
    theme: "emerald",
    tags: ["audio", "workflow"],
    type: "premium",
  },
  {
    id: "articles",
    runtime: "articles",
    capabilityId: "featured-article-processor",
    name: "Article Processor",
    category: "Research",
    when: "You want to know what an article says and how far to trust it.",
    uses: "The article text, or a link you extract first.",
    produces: "An analysis and a summary kept as results.",
    ios: "results-only",
    description: "Analyse and summarise articles to get insights and summaries",
    icon: "newspaper",
    theme: "cyan",
    tags: ["analysis", "summarisation"],
    type: "premium",
  },
  {
    id: "notes",
    runtime: "notes",
    capabilityId: "featured-note-taker",
    name: "Note Taker",
    category: "Documentation",
    when: "Something in a conversation is worth keeping past the conversation.",
    uses: "What you write, or audio and video you hand it.",
    produces: "A note you can search and pull back into any later conversation.",
    ios: "native",
    description: "Take notes and save them for later",
    icon: "notebook-pen",
    theme: "amber",
    tags: ["notes", "workspace"],
    type: "premium",
  },
];

export const MODEL_TOOL_DEFINITIONS: ModelToolDefinition[] = [
  {
    capability: "supportsCodeExecution",
    category: "Development",
    command: "code execution",
    description: "Let supported models run code tools.",
    id: "code_execution",
    label: "Code execution",
  },
  {
    capability: "supportsSearchGrounding",
    category: "Research",
    command: "search grounding",
    description: "Let supported models use search grounding.",
    id: "search_grounding",
    label: "Search grounding",
  },
  {
    capability: "supportsImageGenerationTool",
    category: "AI Generation",
    command: "image generation",
    description: "Let supported models generate images as a response tool.",
    id: "image_generation",
    label: "Image generation",
  },
  {
    capability: "supportsFileSearch",
    category: "Knowledge",
    command: "file search",
    description: "Let supported models search configured vector stores.",
    id: "file_search",
    label: "File search",
    requiresConfiguration: true,
    configurationKind: "file_search",
  },
  {
    capability: "supportsMcp",
    category: "Integrations",
    command: "mcp",
    description: "Let supported models use configured remote MCP servers.",
    id: "mcp",
    label: "MCP",
    requiresConfiguration: true,
    configurationKind: "mcp",
  },
  {
    capability: "supportsToolSearch",
    category: "Utilities",
    command: "tool search",
    description: "Let supported models search the app tool inventory.",
    id: "tool_search",
    label: "Tool search",
  },
  {
    capability: "supportsHostedShell",
    category: "Development",
    command: "hosted shell",
    description: "Let supported models use OpenAI hosted shell.",
    id: "hosted_shell",
    label: "Hosted shell",
  },
  {
    capability: "supportsWebFetch",
    category: "Research",
    command: "web fetch",
    description: "Let supported models fetch URLs present in the conversation.",
    id: "web_fetch",
    label: "Web fetch",
  },
];

export const getExperienceCatalog = (): ExperienceDefinition[] => EXPERIENCES;

export const getProjectExperienceCatalog = (): ProjectExperienceDefinition[] =>
  EXPERIENCES.map(
    ({
      id,
      runtime,
      name,
      description,
      when,
      uses,
      produces,
      ios,
      scope,
      scopeReason,
      icon,
      category,
      theme,
      tags,
      type,
      capabilityId,
    }) => ({
      id,
      runtime,
      name,
      description,
      when,
      uses,
      produces,
      ios,
      scope: scope ?? "any",
      scopeReason: scopeReason ?? null,
      icon,
      category,
      theme,
      tags,
      type,
      requirement: capabilityId
        ? { kind: "capability" as const, capabilityKind: "app" as const, capabilityId }
        : { kind: "capability_kind" as const, capabilityKind: "app" as const },
    }),
  );
