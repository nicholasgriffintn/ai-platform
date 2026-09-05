import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import type { TrainingJobEvent } from "@ngriffin_uk/polychat-schemas";
import { RefreshCcw } from "lucide-react";

import { TrainingStatusBadge } from "./index";
import { formatTrainingDate, getTrainingEventDetail } from "./utils";

interface TrainingLogsResource {
  title: string;
  description: string;
  status: string;
  subtitle?: string;
  failureReason?: string;
}

interface TrainingLogsDialogProps {
  resource: TrainingLogsResource | null;
  events: TrainingJobEvent[];
  emptyMessage: string;
  isLoading: boolean;
  isRefreshing: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export function TrainingLogsDialog({
  resource,
  events,
  emptyMessage,
  isLoading,
  isRefreshing,
  onOpenChange,
  onRefresh,
}: TrainingLogsDialogProps) {
  if (!resource) {
    return null;
  }

  return (
    <Dialog open={Boolean(resource)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Logs</DialogTitle>
          <DialogDescription>{resource.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{resource.title}</div>
                <div className="text-xs text-muted-foreground">{resource.description}</div>
                {resource.subtitle && (
                  <div className="text-xs text-muted-foreground">{resource.subtitle}</div>
                )}
              </div>
              <TrainingStatusBadge status={resource.status} />
            </div>
            {resource.failureReason && (
              <p className="mt-3 rounded-md bg-failure/12 p-2 text-sm text-failure">
                {resource.failureReason}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCcw className="h-4 w-4" />}
              onClick={onRefresh}
              isLoading={isRefreshing}
            >
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading logs...</p>
          ) : events.length > 0 ? (
            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {events.map((event) => {
                const detail = getTrainingEventDetail(event);

                return (
                  <div key={event.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="uppercase tracking-wide text-muted-foreground">
                        {event.level}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTrainingDate(event.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{event.message}</p>
                    {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
