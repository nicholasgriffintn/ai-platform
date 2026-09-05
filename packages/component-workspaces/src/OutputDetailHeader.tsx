import { Button } from "@ngriffin_uk/polychat-component-ui";
import { Check, Share2 } from "lucide-react";

export interface OutputDetailHeaderProps {
  capabilityId: string;
  title: string;
  onShare: () => void;
  isSharing?: boolean;
  hasCopiedLink?: boolean;
  errorMessage?: string;
}

export function OutputDetailHeader({
  capabilityId,
  title,
  onShare,
  isSharing = false,
  hasCopiedLink = false,
  errorMessage,
}: OutputDetailHeaderProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {capabilityId}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{title}</h1>
        </div>
        <Button variant="outline" disabled={isSharing} onClick={onShare}>
          {hasCopiedLink ? <Check size={16} /> : <Share2 size={16} />}
          {hasCopiedLink ? "Link copied" : "Share"}
        </Button>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-failure">
          {errorMessage}
        </p>
      )}
    </>
  );
}
