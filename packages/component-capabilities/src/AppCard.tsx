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
        "relative p-5 shadow-none",
        !isWrappedInGroup && "group",
        isDisabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-border-strong hover:shadow-lg",
        "h-full w-full",
        "transition-all duration-200",
        "focus:ring-2 focus:ring-active-work/40 focus:outline-none",
        "bg-transparent",
        "bg-gradient-to-br",
        getCardGradient(app.theme),
      )}
    >
      {isDisabled && (
        <div className="absolute top-3 right-3 z-10">
          <div
            className={cn("rounded-full p-1.5", isDisabled ? "bg-selection" : "bg-attention")}
            title={requiresSignIn ? "Sign in required" : "Premium Feature"}
          >
            {requiresSignIn ? (
              <Lock className="h-4 w-4 text-foreground" />
            ) : (
              <Crown className="h-4 w-4 text-foreground" />
            )}
          </div>
        </div>
      )}

      <div className={cn("flex h-full flex-col", isDisabled && "pr-10")}>
        <div className="mb-3 flex flex-col space-y-2 md:flex-row md:items-start md:space-y-0 md:space-x-4">
          <div
            className={cn(
              "flex-shrink-0 rounded-lg p-3 shadow-sm",
              getIconContainerClass(app.theme),
            )}
          >
            {getIcon(app.icon, app.theme)}
          </div>
          <div className="flex min-w-0 flex-grow flex-col items-start">
            <h3 className="text-lg font-semibold text-foreground group-hover:underline">
              {app.name}
            </h3>
            {app.category && (
              <span
                className={cn(
                  "mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs no-underline",
                  getBadgeClass(app.theme),
                )}
              >
                {app.category}
              </span>
            )}
          </div>
        </div>

        <p className="mb-4 flex-grow overflow-x-hidden text-left text-sm text-muted-foreground no-underline">
          {app.description}
        </p>
      </div>
    </Card>
  );
};
