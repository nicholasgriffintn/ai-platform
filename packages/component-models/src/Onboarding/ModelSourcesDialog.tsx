import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { Check, CircleDashed, CircleHelp, CircleSlash } from "lucide-react";
import { useState } from "react";

export type Readiness = "ready" | "not-configured" | "not-connected" | "available";
export type ModelSourceReadiness = Readiness;

export interface ModelSource {
  id: string;
  name: string;
  detail: string;
  readiness: Readiness;
  action?: {
    label: string;
    onSelect: () => void | Promise<void>;
  };
}

export interface ModelSourcesDialogProps {
  open: boolean;
  sources: readonly ModelSource[];
  onOpenChange: (open: boolean) => void;
}

const readinessPresentation: Record<
  Readiness,
  { className: string; Icon: typeof Check; label: string }
> = {
  ready: { className: "text-success", Icon: Check, label: "Ready" },
  available: { className: "text-active-work", Icon: CircleHelp, label: "Available" },
  "not-configured": {
    className: "text-attention",
    Icon: CircleDashed,
    label: "Not configured",
  },
  "not-connected": {
    className: "text-muted-foreground",
    Icon: CircleSlash,
    label: "Not connected",
  },
};

export function ModelSourcesDialog({ open, sources, onOpenChange }: ModelSourcesDialogProps) {
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);

  const handleAction = async (source: ModelSource) => {
    if (!source.action || pendingSourceId) {
      return;
    }

    setPendingSourceId(source.id);

    try {
      await source.action.onSelect();
    } finally {
      setPendingSourceId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>How models work here</DialogTitle>
          <DialogDescription>
            Choose where Polychat can find models on this surface. You can change these choices at
            any time.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {sources.map((source) => {
            const presentation = readinessPresentation[source.readiness];
            const isPending = pendingSourceId === source.id;
            const Icon = presentation.Icon;

            return (
              <div
                key={source.id}
                className="flex items-center gap-3 px-4 py-4 first:rounded-t-xl last:rounded-b-xl"
                aria-label={`${source.name}: ${presentation.label}`}
                data-readiness={source.readiness}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas",
                    presentation.className,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{source.name}</p>
                  <p className="text-sm text-muted-foreground">{source.detail}</p>
                </div>
                {source.action && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isPending}
                    disabled={pendingSourceId !== null && !isPending}
                    onClick={() => void handleAction(source)}
                  >
                    {source.action.label}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
