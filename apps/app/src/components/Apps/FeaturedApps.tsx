import { Link } from "react-router";

import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import type { AppListItem } from "~/types/apps";
import { AppCard } from "./AppCard";

const featuredAppsData: AppListItem[] = [
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

interface FeaturedAppsProps {
  searchQuery?: string;
}

export const FeaturedApps = ({ searchQuery = "" }: FeaturedAppsProps) => {
  const { isPro } = useChatStore();

  const filteredFeaturedApps = searchQuery
    ? featuredAppsData.filter((app) => {
        const query = searchQuery.toLowerCase();
        return (
          app.name.toLowerCase().includes(query) ||
          app.description?.toLowerCase().includes(query) ||
          app.category?.toLowerCase().includes(query)
        );
      })
    : featuredAppsData;

  if (filteredFeaturedApps.length === 0) {
    return null;
  }

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    app: AppListItem,
  ) => {
    if (app.type === "premium" && !isPro) {
      e.preventDefault();
    }
  };

  return (
    <div className="space-y-6 mb-12">
      <h2
        className={cn(
          "text-xl font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-2",
        )}
      >
        Featured Apps
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFeaturedApps.map((app) => {
          const isPremium = app.type === "premium";
          const isDisabled = isPremium && !isPro;

          return (
            <div
              key={app.id}
              className={cn(
                "h-[200px]",
                isDisabled
                  ? ""
                  : "transform transition-transform hover:scale-[1.02]",
              )}
            >
              <Link
                to={app.href || "#"}
                onClick={(e) => handleClick(e, app)}
                style={{ textDecoration: "none" }}
                className="block h-full focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl group"
                aria-disabled={isDisabled}
              >
                <AppCard
                  app={app}
                  onSelect={() => {}}
                  isWrappedInGroup={true}
                />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};
