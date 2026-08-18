import { Button, Card, EmptyState, getStatusIcon } from "@ngriffin_uk/polychat-component-ui";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { Activity } from "lucide-react";

export interface ProjectActivitySummary {
  id: string;
  summary: string;
  capabilityId: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ProjectActivityListProps {
  activities: ProjectActivitySummary[];
  isLoading: boolean;
  errorMessage?: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore: () => void;
}

export function ProjectActivityList({
  activities,
  isLoading,
  errorMessage,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: ProjectActivityListProps) {
  if (errorMessage) {
    return <EmptyState title="Activity unavailable" message={errorMessage} />;
  }

  if (isLoading) {
    return <Card className="p-6 text-sm text-zinc-500 shadow-none">Loading activity…</Card>;
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<Activity size={24} className="text-zinc-400" />}
        title="No activity yet"
        message="Capability runs will appear here."
        className="min-h-[240px]"
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        {activities.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-0 dark:border-zinc-800"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {getStatusIcon(item.status)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-medium">{item.summary}</h2>
              <p className="text-xs text-zinc-500">
                {item.capabilityId} · {formatDate(item.updatedAt ?? item.createdAt)}
              </p>
            </div>
            <span className="text-xs capitalize text-zinc-500">{item.status}</span>
          </div>
        ))}
      </Card>
      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="secondary" disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? "Loading…" : "Load more activity"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
