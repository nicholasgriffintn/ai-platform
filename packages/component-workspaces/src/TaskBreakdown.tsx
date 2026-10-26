import { Button } from "@ngriffin_uk/polychat-component-ui";
import { projectTaskPriorityLabels, type TaskBreakdown } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";

import { TaskSection } from "./TaskWorkSections";
import { describeWorkActor, type WorkDirectory } from "./work-actors";

export function TaskBreakdownSection({
  breakdown,
  directory,
  isBusy,
  onAccept,
}: {
  breakdown: TaskBreakdown;
  directory: WorkDirectory;
  isBusy: boolean;
  onAccept: (revision: number) => void;
}) {
  if (breakdown.acceptedAt) {
    return null;
  }

  const keyIndex = new Map(breakdown.items.map((item, index) => [item.key, index + 1]));

  return (
    <TaskSection
      title="Proposed sub-tasks"
      meta={`Revision ${breakdown.revision} · ${describeWorkActor(breakdown.proposedBy, directory)} · ${formatRelativeTime(breakdown.proposedAt)}`}
    >
      <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {breakdown.items.map((item, index) => (
          <li
            key={item.key}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-3 px-3 py-2.5"
          >
            <span className="pt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="line-clamp-2 text-sm">{item.objective}</p>
              {item.dependsOn.length ? (
                <p className="text-xs text-muted-foreground">
                  After {item.dependsOn.map((key) => keyIndex.get(key) ?? key).join(", ")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-0.5 text-xs whitespace-nowrap text-muted-foreground">
              <span>{item.owner ? describeWorkActor(item.owner, directory) : "Unassigned"}</span>
              {item.priority !== "none" ? (
                <span>{projectTaskPriorityLabels[item.priority]}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Nothing is created until this revision is accepted. Comment below to ask for changes.
        </p>
        <Button
          size="sm"
          variant="primary"
          disabled={isBusy}
          onClick={() => onAccept(breakdown.revision)}
        >
          Create these sub-tasks
        </Button>
      </div>
    </TaskSection>
  );
}
