import type { AppListItem } from "~/lib/api/dynamic-apps";
import { cn } from "~/lib/utils";
import { getCardGradient, getCategoryColor, getIcon } from "./utils";

interface AppCardProps {
  app: AppListItem;
  onSelect: () => void;
}

export const AppCard = ({ app, onSelect }: AppCardProps) => {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer w-full h-full border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-gradient-to-br hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        getCardGradient(app.icon),
      )}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      tabIndex={0}
      aria-label={`Select ${app.name} app`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center space-x-4 mb-3">
          <div
            className={cn(
              "p-3 rounded-lg bg-off-white dark:bg-zinc-700 shadow-sm",
            )}
          >
            {getIcon(app.icon)}
          </div>
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
            {app.name}
          </h3>

          {app.category && (
            <span
              className={cn(
                "inline-block px-3 py-1 text-xs rounded-full",
                getCategoryColor(app.category),
              )}
            >
              {app.category}
            </span>
          )}
        </div>

        <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-4 flex-grow text-left overflow-x-hidden">
          {app.description}
        </p>
      </div>
    </button>
  );
};
