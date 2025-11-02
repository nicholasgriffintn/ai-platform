import type { AppListItem } from "~/types/apps";

export const featuredAppsData: AppListItem[] = [
  {
    id: "featured-replicate",
    name: "Replicate Predictions",
    description:
      "Generate images, videos, audio, and more with state-of-the-art AI models",
    icon: "sparkles",
    category: "AI Generation",
    href: "/apps/replicate",
    type: "premium",
  },
  {
    id: "featured-drawing",
    name: "Drawing",
    description:
      "Create drawings and get AI to enhance them or guess what they are",
    icon: "pencil",
    category: "Media",
    href: "/apps/drawing",
    type: "premium",
  },
  {
    id: "featured-podcast-processor",
    name: "Podcast Processor",
    description:
      "Upload and process your podcast to get transcription, summary, and cover image",
    icon: "speech",
    category: "Media",
    href: "/apps/podcasts",
    type: "premium",
  },
  {
    id: "featured-article-processor",
    name: "Article Processor",
    description: "Analyse and summarise articles to get insights and summaries",
    icon: "document",
    category: "Text",
    href: "/apps/articles",
    type: "premium",
  },
  {
    id: "featured-note-taker",
    name: "Note Taker",
    description: "Take notes and save them for later",
    icon: "note",
    category: "Productivity",
    href: "/apps/notes",
    type: "premium",
  },
];
