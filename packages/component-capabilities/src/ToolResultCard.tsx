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
    <div className="mx-auto max-w-3xl">
      <div
        className={cn(
          "rounded-xl border border-border bg-surface-elevated p-5 transition-all duration-200 hover:border-border-strong hover:shadow-lg",
          "bg-gradient-to-br",
          getCardGradient(theme),
          "mb-6",
        )}
      >
        <div className="mb-6">
          <div className="mb-4 flex items-center space-x-4">
            <div className={cn("rounded-lg p-3 shadow-sm", getIconContainerClass(theme))}>
              {getIcon(icon, theme)}
            </div>
            <div>
              <h1 className={cn("mb-2 text-2xl font-bold text-foreground")}>{name} - Results</h1>
              <p className={cn("text-muted-foreground")}>{message || `Results for ${name}`}</p>
              {timestamp && (
                <p className={cn("text-sm text-muted-foreground", "mt-1")}>
                  Generated on: {new Date(timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-surface-elevated p-5">{children}</div>

        <div className="mt-6 flex justify-between">
          <Button variant="secondary" onClick={onReset}>
            Start Over
          </Button>
        </div>
      </div>
    </div>
  );
}
