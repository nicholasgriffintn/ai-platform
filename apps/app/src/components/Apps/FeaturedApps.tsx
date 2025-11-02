import { Link } from "react-router";

import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import type { AppListItem } from "~/types/apps";
import { AppCard } from "./AppCard";
import { featuredAppsData } from "./featuredAppsData";

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
      return;
    }
  };

  return (
    <div className="space-y-6 mb-12">
      <h2
        data-category="Featured"
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
