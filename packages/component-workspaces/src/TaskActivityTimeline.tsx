import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import type {
  ProjectTaskActivityItem,
  ProjectTaskActivityTimeline as ProjectTaskActivityTimelineContract,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import {
  CheckCircle2,
  CircleDot,
  CircleEllipsis,
  FileOutput,
  ListChecks,
  MessageCircleQuestion,
  OctagonX,
  Wrench,
} from "lucide-react";
import { useState } from "react";

export interface TaskActivityTimelineProps {
  timeline: ProjectTaskActivityTimelineContract;
  renderDetail?: (detail: string) => React.ReactNode;
}

const STATUS_LABELS: Record<ProjectTaskActivityItem["status"], string> = {
  proposed: "Proposed",
  active: "In progress",
  waiting: "Waiting",
  succeeded: "Completed",
  failed: "Failed",
  interrupted: "Interrupted",
  cancelled: "Cancelled",
  resolved: "Resolved",
  unknown: "Activity",
};

function ActivityIcon({ item }: { item: ProjectTaskActivityItem }) {
  if (item.status === "failed" || item.status === "interrupted" || item.status === "cancelled") {
    return <OctagonX size={15} aria-hidden />;
  }

  if (item.status === "succeeded" || item.status === "resolved") {
    return <CheckCircle2 size={15} aria-hidden />;
  }

  switch (item.category) {
    case "plan":
      return <ListChecks size={15} aria-hidden />;
    case "tool":
      return <Wrench size={15} aria-hidden />;
    case "interaction":
      return <MessageCircleQuestion size={15} aria-hidden />;
    case "output":
      return <FileOutput size={15} aria-hidden />;
    case "step":
      return <CircleDot size={15} aria-hidden />;
    case "run":
      return <CircleEllipsis size={15} aria-hidden />;
  }

  return <CircleEllipsis size={15} aria-hidden />;
}

export function TaskActivityTimeline({ timeline, renderDetail }: TaskActivityTimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  if (timeline.items.length === 0) {
    return <p className="text-sm text-zinc-500">No activity recorded yet.</p>;
  }

  return (
    <ol aria-label="Task activity timeline" className="space-y-3">
      {timeline.items.map((item) => {
        const hasDetail = Boolean(item.detail) || item.items.length > 0;
        const isExpanded = expanded.has(item.id);

        return (
          <li
            key={item.id}
            className={`rounded-lg border p-3 ${
              item.actionable
                ? "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-zinc-500" aria-hidden>
                <ActivityIcon item={item} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </p>
                  <Badge variant={item.actionable ? "warning" : "outline"}>
                    {STATUS_LABELS[item.status]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {formatRelativeTime(item.occurredAt)}
                  {item.runId ? ` · Run ${item.runId}` : " · Proposed plan"}
                </p>
                {hasDetail ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 px-0"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpanded((current) => {
                        const next = new Set(current);

                        if (next.has(item.id)) {
                          next.delete(item.id);
                        } else {
                          next.add(item.id);
                        }

                        return next;
                      });
                    }}
                  >
                    {isExpanded ? "Hide details" : "Show details"}
                  </Button>
                ) : null}
                {isExpanded ? (
                  <div className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {item.detail ? (
                      renderDetail ? (
                        renderDetail(item.detail)
                      ) : (
                        <p className="whitespace-pre-wrap">{item.detail}</p>
                      )
                    ) : null}
                    {item.items.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {item.items.map((detail) => (
                          <li key={`${item.id}:${detail}`}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
