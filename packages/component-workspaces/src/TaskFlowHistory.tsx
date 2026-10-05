import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  findProjectFlowNode,
  type ProjectFlowEvent,
  type ProjectTask,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";

const EVENT_LABELS: Record<ProjectFlowEvent["kind"], string> = {
  entered: "Started",
  waiting: "Waiting",
  dispatched: "Queued",
  resumed: "Continued",
  branch: "Selected a path",
  iteration: "Started an iteration",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function TaskFlowHistory({
  task,
  events,
  hasMore,
  isLoading,
  errorMessage,
  onLoadMore,
}: {
  task: ProjectTask;
  events: ProjectFlowEvent[];
  hasMore: boolean;
  isLoading: boolean;
  errorMessage?: string;
  onLoadMore: () => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Flow history</h2>
      {errorMessage ? (
        <p role="alert" className="text-sm text-failure">
          {errorMessage}
        </p>
      ) : (
        <ol className="space-y-2 border-l border-border pl-4">
          {events.map((event) => (
            <li key={event.sequence} className="text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="font-medium">
                  {findProjectFlowNode(task.flowSnapshot, event.nodeId)?.name ?? event.nodeId}
                </span>
                <span className="text-muted-foreground">
                  {EVENT_LABELS[event.kind]} · {formatRelativeTime(event.createdAt)}
                </span>
              </div>
              {event.detail && (
                <p className="whitespace-pre-wrap text-muted-foreground">{event.detail}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {!events.length && !errorMessage && (
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading history…" : "This task has not started."}
        </p>
      )}
      {hasMore && (
        <Button variant="outline" size="sm" isLoading={isLoading} onClick={onLoadMore}>
          Load more history
        </Button>
      )}
    </section>
  );
}
