import type { AppListItem } from "~/lib/api/dynamic-apps";
import { styles } from "./utils";

interface AppCardProps {
  app: AppListItem;
  onSelect: () => void;
}

export const AppCard = ({ app, onSelect }: AppCardProps) => {
  return (
    <button
      type="button"
      className={`cursor-pointer w-full h-full ${styles.cardWithGradient(app.icon)} focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      tabIndex={0}
      aria-label={`Select ${app.name} app`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center space-x-4 mb-3">
          <div className={styles.iconContainer}>{styles.getIcon(app.icon)}</div>
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
            {app.name}
          </h3>

          {app.category && (
            <span className={styles.badge(app.category)}>{app.category}</span>
          )}
        </div>

        <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-4 flex-grow text-left overflow-x-hidden">
          {app.description}
        </p>
      </div>
    </button>
  );
};
