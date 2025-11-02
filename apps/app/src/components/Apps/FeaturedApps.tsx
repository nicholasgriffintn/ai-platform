import { Link } from "react-router";

import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import type { AppListItem } from "~/types/apps";
import { AppCard } from "./AppCard";

interface FeaturedAppsProps {
  searchQuery?: string;
  apps: AppListItem[];
  onSelect?: (app: AppListItem) => void;
}

export const FeaturedApps = ({
  searchQuery = "",
  apps,
  onSelect,
}: FeaturedAppsProps) => {
  const { isPro } = useChatStore();

  const filteredFeaturedApps = searchQuery
    ? apps.filter((app) => {
        const query = searchQuery.toLowerCase();
        return (
          app.name.toLowerCase().includes(query) ||
          app.description?.toLowerCase().includes(query) ||
          app.category?.toLowerCase().includes(query)
        );
      })
    : apps;

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

    if (!app.href) {
      e.preventDefault();
      if (app.kind === "dynamic" && onSelect) {
        onSelect(app);
      }
      return;
    }
  };

  return (
    <div className="space-y-6 mb-6">
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
          const isLink = Boolean(app.href);

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
              {isLink ? (
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
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect?.(app)}
                  disabled={isDisabled}
                  className="block h-full w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl group text-left"
                >
                  <AppCard
                    app={app}
                    onSelect={() => {}}
                    isWrappedInGroup={true}
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
