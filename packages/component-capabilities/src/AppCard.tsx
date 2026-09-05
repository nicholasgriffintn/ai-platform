import { Card, cn } from "@ngriffin_uk/polychat-component-ui";
import type { CapabilityCatalogItem as AppListItem } from "@ngriffin_uk/polychat-schemas";
import { Crown, Lock } from "lucide-react";

import { getBadgeClass, getCardGradient, getIcon, getIconContainerClass } from "./capability-theme";

export interface AppCardProps {
  app: AppListItem;
  isAuthenticated: boolean;
  isPro: boolean;
  onSelect: () => void;
  isWrappedInGroup?: boolean;
}

export const AppCard = ({
  app,
  isAuthenticated,
  isPro,
  onSelect,
  isWrappedInGroup = false,
}: AppCardProps) => {
  const isPremium = app.type === "premium";
  const requiresSignIn = app.type === "byok" && !isAuthenticated;
  const isDisabled = (isPremium && !isPro) || requiresSignIn;

  return (
    <Card
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={isDisabled ? undefined : onSelect}
      onKeyDown={(event) => {
        if (isDisabled || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onSelect();
      }}
      aria-label={`Open ${app.name}${isPremium ? " (Premium)" : ""}${requiresSignIn ? " (Sign in required)" : ""}`}
      aria-disabled={isDisabled}
      className={cn(
        "p-5 shadow-none relative",
        !isWrappedInGroup && "group",
        isDisabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:shadow-lg hover:border-border-strong",
        "w-full h-full",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-active-work/40",
        "bg-transparent",
        "bg-gradient-to-br",
        getCardGradient(app.theme),
      )}
    >
      {isDisabled && (
        <div className="absolute top-3 right-3 z-10">
          <div
            className={cn("p-1.5 rounded-full", isDisabled ? "bg-selection" : "bg-attention")}
            title={requiresSignIn ? "Sign in required" : "Premium Feature"}
          >
            {requiresSignIn ? (
              <Lock className="w-4 h-4 text-foreground" />
            ) : (
              <Crown className="w-4 h-4 text-foreground" />
            )}
          </div>
        </div>
      )}

      <div className={cn("flex flex-col h-full", isDisabled && "pr-10")}>
        <div className="flex flex-col space-y-2 md:flex-row md:items-start md:space-y-0 md:space-x-4 mb-3">
          <div
            className={cn(
              "p-3 rounded-lg shadow-sm flex-shrink-0",
              getIconContainerClass(app.theme),
            )}
          >
            {getIcon(app.icon, app.theme)}
          </div>
          <div className="flex flex-col items-start flex-grow min-w-0">
            <h3 className="font-semibold text-lg text-foreground group-hover:underline">
              {app.name}
            </h3>
            {app.category && (
              <span
                className={cn(
                  "inline-flex items-center px-3 py-1 text-xs rounded-full mt-1 no-underline",
                  getBadgeClass(app.theme),
                )}
              >
                {app.category}
              </span>
            )}
          </div>
        </div>

        <p className="text-muted-foreground text-sm mb-4 flex-grow text-left overflow-x-hidden no-underline">
          {app.description}
        </p>
      </div>
    </Card>
  );
};
