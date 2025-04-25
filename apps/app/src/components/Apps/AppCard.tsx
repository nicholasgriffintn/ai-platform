import { Card } from "~/components/ui";
import { cn } from "~/lib/utils";
import type { AppListItem } from "~/types/apps";
import { getCardGradient, getCategoryColor, getIcon } from "./utils";

interface AppCardProps {
  app: AppListItem;
  onSelect: () => void;
}

export const AppCard = ({ app, onSelect }: AppCardProps) => {
  return (
    <Card
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      aria-label={`Select ${app.name} app`}
      className={cn(
        "p-5 shadow-none",
        "cursor-pointer w-full h-full",
        "hover:shadow-lg transition-all duration-200",
        "hover:border-zinc-300 dark:hover:border-zinc-600",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        "bg-transparent",
        "bg-gradient-to-br",
        getCardGradient(app.icon),
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex flex-col space-y-2 md:flex-row md:items-start md:space-y-0 md:space-x-4 mb-3">
          <div
            className={cn(
              "p-3 rounded-lg bg-off-white dark:bg-zinc-700 shadow-sm flex-shrink-0",
            )}
          >
            {getIcon(app.icon)}
          </div>
          <div className="flex flex-col items-start flex-grow min-w-0">
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
              {app.name}
            </h3>

            {app.category && (
              <span
                className={cn(
                  "inline-block px-3 py-1 text-xs rounded-full mt-1",
                  getCategoryColor(app.category),
                )}
              >
                {app.category}
              </span>
            )}
          </div>
        </div>

        <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-4 flex-grow text-left overflow-x-hidden">
          {app.description}
        </p>
      </div>
    </Card>
  );
};
