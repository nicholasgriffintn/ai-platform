import { Link } from "react-router";

import { cn } from "~/lib/utils";
import type { AppListItem } from "~/types/apps";
import { AppCard } from "./AppCard";

const featuredAppsData: AppListItem[] = [
  {
    id: "featured-podcast-processor",
    name: "Podcast Processor",
    description:
      "Upload and process your podcast to get transcription, summary, and cover image",
    icon: "speech",
    category: "Media",
    href: "/apps/podcasts",
  },
  {
    id: "featured-article-processor",
    name: "Article Processor",
    description: "Analyse and summarise articles to get insights and summaries",
    icon: "document",
    category: "Text",
    href: "/apps/articles",
  },
  {
    id: "featured-note-taker",
    name: "Note Taker",
    description: "Take notes and save them for later",
    icon: "note",
    category: "Productivity",
    href: "/apps/notes",
  },
];

export const FeaturedApps = () => {
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
        {featuredAppsData.map((app) => (
          <Link
            key={app.id}
            to={app.href || "#"}
            className="block transform transition-transform hover:scale-[1.02] h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl no-underline"
          >
            <AppCard app={app} onSelect={() => {}} />
          </Link>
        ))}
      </div>
    </div>
  );
};
