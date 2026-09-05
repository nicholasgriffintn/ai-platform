import { Button, ButtonLink, cn } from "@ngriffin_uk/polychat-component-ui";
import { X } from "lucide-react";

export type ComposerBannerTone = "info" | "warning" | "critical";

export type ComposerBannerDismissalScope = "session" | "day" | "forever";

export interface ComposerBannerDescriptor {
  id: string;
  tone: ComposerBannerTone;
  title?: string;
  message: string;
  action?: {
    label: string;
    to: string;
  };
  dismissal?: {
    scope: ComposerBannerDismissalScope;
    suggestion?: boolean;
  };
}

const toneClasses: Record<ComposerBannerTone, string> = {
  info: "border-border bg-surface-elevated text-foreground",
  warning: "border-attention/40 bg-attention/12 text-foreground",
  critical: "border-failure/40 bg-failure/12 text-foreground",
};

const actionClasses: Record<ComposerBannerTone, string> = {
  info: "border-border bg-surface text-foreground hover:bg-selection",
  warning: "border-attention/50 bg-surface text-foreground hover:bg-attention/15",
  critical: "border-failure/50 bg-surface text-foreground hover:bg-failure/15",
};

export interface ComposerBannerCardProps {
  banner: ComposerBannerDescriptor;
  onDismiss?: () => void;
}

export function ComposerBannerCard({ banner, onDismiss }: ComposerBannerCardProps) {
  return (
    <div
      role={banner.tone === "critical" ? "alert" : "status"}
      className={cn("mb-3 rounded-lg border px-4 py-3 shadow-sm", toneClasses[banner.tone])}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          {banner.title && <p className="font-medium">{banner.title}</p>}
          <p className={cn(banner.title && "mt-0.5 text-xs opacity-90")}>{banner.message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {banner.action && (
            <ButtonLink
              variant="outline"
              size="xs"
              href={banner.action.to}
              className={actionClasses[banner.tone]}
            >
              {banner.action.label}
            </ButtonLink>
          )}
          {onDismiss && (
            <Button
              variant="icon"
              size="xs"
              aria-label={
                banner.dismissal?.scope === "day" ? "Dismiss for today" : "Dismiss notification"
              }
              className="hover:bg-selection text-current opacity-60 hover:text-current hover:opacity-100"
              onClick={onDismiss}
            >
              <X size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
