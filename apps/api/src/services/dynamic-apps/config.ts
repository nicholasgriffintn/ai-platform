import type { AppTheme } from "~/types/app-schema";

type DynamicAppCategory =
  | "Agents & Delegation"
  | "Research & Retrieval"
  | "Content Generation"
  | "Code Assistance"
  | "Productivity & Coaching"
  | "Data & Utilities";

export type AppKind = "dynamic" | "frontend";

export interface DynamicAppMetadata {
  category: DynamicAppCategory;
  icon?: string;
  theme?: AppTheme;
  tags?: string[];
  featured?: boolean;
}

export interface FeaturedAppDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  theme?: AppTheme;
  tags?: string[];
  type?: "normal" | "premium";
  href: string;
  kind?: AppKind;
}

export const FUNCTION_APP_METADATA: Record<string, DynamicAppMetadata> = {
  add_reasoning_step: {
    category: "Agents & Delegation",
    icon: "brain-circuit",
    theme: "violet",
    tags: ["agents", "reasoning", "workflow"],
  },
  delegate_to_team_member: {
    category: "Agents & Delegation",
    icon: "users",
    theme: "violet",
    tags: ["agents", "delegation"],
  },
  delegate_to_team_member_by_role: {
    category: "Agents & Delegation",
    icon: "user-cog",
    theme: "violet",
    tags: ["agents", "delegation"],
  },
  get_team_members: {
    category: "Agents & Delegation",
    icon: "users-round",
    theme: "violet",
    tags: ["agents", "directory"],
  },
  extract_content: {
    category: "Research & Retrieval",
    icon: "file-search",
    theme: "cyan",
    tags: ["retrieval", "content"],
  },
  analyse_hacker_news: {
    category: "Research & Retrieval",
    icon: "newspaper",
    theme: "cyan",
    tags: ["analysis", "news"],
  },
  web_search: {
    category: "Research & Retrieval",
    icon: "search",
    theme: "cyan",
    tags: ["search", "information"],
  },
  research: {
    category: "Research & Retrieval",
    icon: "book-open",
    theme: "cyan",
    tags: ["research", "analysis"],
  },
  get_weather: {
    category: "Data & Utilities",
    icon: "cloud-sun",
    theme: "sky",
    tags: ["weather", "forecast"],
  },
  capture_screenshot: {
    category: "Content Generation",
    icon: "camera",
    theme: "amber",
    tags: ["visual", "capture"],
  },
  create_image: {
    category: "Content Generation",
    icon: "image",
    theme: "pink",
    tags: ["visual", "generation"],
  },
  create_video: {
    category: "Content Generation",
    icon: "clapperboard",
    theme: "rose",
    tags: ["video", "generation"],
  },
  create_music: {
    category: "Content Generation",
    icon: "music",
    theme: "indigo",
    tags: ["audio", "generation"],
  },
  create_speech: {
    category: "Content Generation",
    icon: "mic",
    theme: "emerald",
    tags: ["audio", "speech"],
  },
  fill_in_middle_completion: {
    category: "Code Assistance",
    icon: "braces",
    theme: "slate",
    tags: ["code", "completion"],
  },
  next_edit_completion: {
    category: "Code Assistance",
    icon: "code-2",
    theme: "slate",
    tags: ["code", "editing"],
  },
  apply_edit_completion: {
    category: "Code Assistance",
    icon: "wand-2",
    theme: "slate",
    tags: ["code", "editing"],
  },
  v0_code_generation: {
    category: "Code Assistance",
    icon: "binary",
    theme: "slate",
    tags: ["code", "generation"],
  },
  prompt_coach: {
    category: "Productivity & Coaching",
    icon: "sparkles",
    theme: "violet",
    tags: ["prompting", "coaching"],
  },
  tutor: {
    category: "Productivity & Coaching",
    icon: "graduation-cap",
    theme: "emerald",
    tags: ["learning", "guidance"],
  },
};

export const FEATURED_APPS: FeaturedAppDefinition[] = [
  {
    id: "featured-replicate",
    name: "Replicate Predictions",
    description:
      "Generate images, videos, audio, and more with state-of-the-art AI models",
    icon: "sparkles",
    category: "AI Generation",
    theme: "violet",
    tags: ["media", "multi-modal", "generation"],
    href: "/apps/replicate",
    type: "premium",
    kind: "frontend",
  },
  {
    id: "featured-drawing",
    name: "Drawing",
    description:
      "Create drawings and get AI to enhance them or guess what they are",
    icon: "pencil",
    category: "Media",
    theme: "rose",
    tags: ["creative", "canvas"],
    href: "/apps/drawing",
    type: "premium",
    kind: "frontend",
  },
  {
    id: "featured-podcast-processor",
    name: "Podcast Processor",
    description:
      "Upload and process your podcast to get transcription, summary, and cover image",
    icon: "mic",
    category: "Media",
    theme: "emerald",
    tags: ["audio", "workflow"],
    href: "/apps/podcasts",
    type: "premium",
    kind: "frontend",
  },
  {
    id: "featured-article-processor",
    name: "Article Processor",
    description: "Analyse and summarise articles to get insights and summaries",
    icon: "newspaper",
    category: "Text",
    theme: "cyan",
    tags: ["analysis", "summarisation"],
    href: "/apps/articles",
    type: "premium",
    kind: "frontend",
  },
  {
    id: "featured-note-taker",
    name: "Note Taker",
    description: "Take notes and save them for later",
    icon: "notebook-pen",
    category: "Productivity",
    theme: "amber",
    tags: ["notes", "workspace"],
    href: "/apps/notes",
    type: "premium",
    kind: "frontend",
  },
];

export const getFunctionMetadata = (
  name: string,
): DynamicAppMetadata | undefined => {
  return FUNCTION_APP_METADATA[name];
};

export const getFeaturedApps = (): FeaturedAppDefinition[] => FEATURED_APPS;
