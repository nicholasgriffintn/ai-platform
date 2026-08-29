import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { getCardGradient, getIcon, getIconContainerClass } from "./capability-theme";

export interface ToolResultCardProps {
  name: string;
  theme?: string;
  icon?: string;
  message?: string;
  timestamp?: string;
  children: ReactNode;
  onReset: () => void;
}

export function ToolResultCard({
  name,
  theme,
  icon,
  message,
  timestamp,
  children,
  onReset,
}: ToolResultCardProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <div
        className={cn(
          "border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-off-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600",
          "bg-gradient-to-br",
          getCardGradient(theme),
          "mb-6",
        )}
      >
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className={cn("p-3 rounded-lg shadow-sm", getIconContainerClass(theme))}>
              {getIcon(icon, theme)}
            </div>
            <div>
              <h1 className={cn("text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-50")}>
                {name} - Results
              </h1>
              <p className={cn("text-zinc-600 dark:text-zinc-300")}>
                {message || `Results for ${name}`}
              </p>
              {timestamp && (
                <p className={cn("text-sm text-zinc-500 dark:text-zinc-400", "mt-1")}>
                  Generated on: {new Date(timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-off-white/80 dark:bg-zinc-800/80 p-5 rounded-lg">{children}</div>

        <div className="flex justify-between mt-6">
          <Button variant="secondary" onClick={onReset}>
            Start Over
          </Button>
        </div>
      </div>
    </div>
  );
}
