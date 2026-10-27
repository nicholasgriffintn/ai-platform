import { cn, TextLink } from "@ngriffin_uk/polychat-component-ui";
import {
  PROJECT_TASK_PRIORITIES,
  projectTaskPriorityLabels,
  type ProjectTask,
  type ProjectTaskPriority,
  type WorkActor,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, initialsOf } from "@ngriffin_uk/polychat-utility-core";
import { Check, Circle } from "lucide-react";
import type { ReactNode } from "react";

import { PropertyPicker, PropertyRow } from "./PropertyPicker";
import { TaskStatusBadge } from "./TaskStatusBadge";
import {
  decodeWorkActor,
  describeWorkActor,
  encodeWorkActor,
  workActorOptions,
  type WorkDirectory,
} from "./work-actors";
import { PriorityBars } from "./WorkTaskViews";

type TaskHref = (task: Pick<ProjectTask, "id" | "projectId">) => string;

function ActorAvatar({ name, isTeammate }: { name: string; isTeammate: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
        isTeammate ? "bg-active-work/15 text-active-work" : "bg-selection text-foreground",
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

function SidebarSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-1 border-t border-border py-4 first:border-t-0 first:pt-0">
      {title ? (
        <h2 className="pb-1 text-xs font-medium tracking-wide text-muted-foreground">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

function BriefNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5 text-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="leading-6 whitespace-pre-wrap">{children}</p>
    </div>
  );
}

export function TaskSidebar({
  task,
  stageName,
  directory,
  blockedBy,
  taskHref,
  isBusy,
  onAssign,
  onSetReviewer,
  onSetPriority,
  onSetDueAt,
}: {
  task: ProjectTask;
  stageName: string | null;
  directory: WorkDirectory;
  blockedBy: readonly ProjectTask[];
  taskHref: TaskHref;
  isBusy: boolean;
  onAssign: (owner: WorkActor | null) => void;
  onSetReviewer: (reviewer: WorkActor) => void;
  onSetPriority: (priority: ProjectTaskPriority) => void;
  onSetDueAt: (dueAt: string | null) => void;
}) {
  const isFinished = task.status === "done" || task.status === "cancelled";
  const isRunning = task.status === "running" || task.status === "queued";
  const actorOptions = workActorOptions(directory).map((option) => {
    const actor = decodeWorkActor(option.value);

    return {
      ...option,
      icon: actor ? (
        <ActorAvatar name={option.label} isTeammate={actor.type === "teammate"} />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border border-dashed border-border-strong" />
      ),
    };
  });
  const budgetRatio = task.tokenBudget ? Math.min(1, task.tokensSpent / task.tokenBudget) : 0;

  return (
    <div className="text-sm">
      <SidebarSection>
        <PropertyRow label="Status">
          <span className="flex flex-wrap items-center gap-1.5 px-2">
            <TaskStatusBadge status={task.status} />
            {stageName ? <span className="text-xs text-muted-foreground">{stageName}</span> : null}
          </span>
        </PropertyRow>
        <PropertyRow label="Priority">
          <PropertyPicker
            label="Priority"
            value={task.priority}
            placeholder="No priority"
            disabled={isBusy}
            options={PROJECT_TASK_PRIORITIES.map((priority) => ({
              value: priority,
              label: projectTaskPriorityLabels[priority],
              icon: <PriorityBars priority={priority} />,
            }))}
            onChange={onSetPriority}
          />
        </PropertyRow>
        <PropertyRow label="Owner">
          <PropertyPicker
            label="Owner"
            value={encodeWorkActor(task.owner)}
            placeholder="Unassigned"
            disabled={isBusy || isRunning || isFinished}
            options={actorOptions}
            onChange={(value) => onAssign(decodeWorkActor(value))}
          />
        </PropertyRow>
        <PropertyRow label="Reviewer">
          <PropertyPicker
            label="Reviewer"
            value={task.reviewer ? encodeWorkActor(task.reviewer) : null}
            placeholder="Nobody yet"
            disabled={isBusy || isFinished}
            options={actorOptions.filter((option) => option.value !== "none")}
            onChange={(value) => {
              const reviewer = decodeWorkActor(value);

              if (reviewer) {
                onSetReviewer(reviewer);
              }
            }}
          />
        </PropertyRow>
        <PropertyRow label="Due">
          <input
            aria-label="Due date"
            type="date"
            className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-foreground hover:bg-selection/60 focus:border-border focus:outline-none"
            value={task.dueAt ? task.dueAt.slice(0, 10) : ""}
            disabled={isBusy}
            onChange={(event) =>
              onSetDueAt(
                event.target.value
                  ? new Date(`${event.target.value}T17:00:00Z`).toISOString()
                  : null,
              )
            }
          />
        </PropertyRow>
        <PropertyRow label="Responsible">
          <span className="block truncate px-2">
            {task.runnerIdentityUserId
              ? describeWorkActor({ type: "person", userId: task.runnerIdentityUserId }, directory)
              : "Whoever starts it"}
          </span>
        </PropertyRow>
        {task.parentTaskId ? (
          <PropertyRow label="Parent">
            <span className="block px-2">
              <TextLink
                href={taskHref({ id: task.parentTaskId, projectId: task.projectId })}
                size="xs"
              >
                Open parent task
              </TextLink>
            </span>
          </PropertyRow>
        ) : null}
      </SidebarSection>

      {blockedBy.length > 0 ? (
        <SidebarSection title="Waits on">
          <ul className="space-y-1.5">
            {blockedBy.map((dependency) => (
              <li key={dependency.id} className="flex items-start gap-2">
                {dependency.status === "done" ? (
                  <Check size={13} className="mt-1 shrink-0 text-success" />
                ) : (
                  <Circle size={13} className="mt-1 shrink-0 text-muted-foreground" />
                )}
                <TextLink href={taskHref(dependency)} size="xs">
                  {dependency.key ? `${dependency.key} ` : ""}
                  {dependency.objective}
                </TextLink>
              </li>
            ))}
          </ul>
        </SidebarSection>
      ) : null}

      {task.expectedOutput || task.context?.notes || task.constraints?.notes ? (
        <SidebarSection title="Brief">
          <div className="space-y-3">
            {task.expectedOutput ? (
              <BriefNote label="Expected output">{task.expectedOutput}</BriefNote>
            ) : null}
            {task.context?.notes ? (
              <BriefNote label="Context">{task.context.notes}</BriefNote>
            ) : null}
            {task.constraints?.notes ? (
              <BriefNote label="Constraints">{task.constraints.notes}</BriefNote>
            ) : null}
          </div>
        </SidebarSection>
      ) : null}

      <SidebarSection title="Usage">
        <div className="space-y-1.5 px-0.5">
          <p className="flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
            <span>{task.tokensSpent.toLocaleString()} tokens</span>
            {task.tokenBudget ? <span>of {task.tokenBudget.toLocaleString()}</span> : null}
          </p>
          {task.tokenBudget ? (
            <div className="h-1 overflow-hidden rounded-full bg-selection">
              <div
                className={cn(
                  "h-full rounded-full",
                  budgetRatio >= 0.9 ? "bg-attention" : "bg-active-work",
                )}
                style={{ width: `${budgetRatio * 100}%` }}
              />
            </div>
          ) : null}
          <p className="pt-1 text-xs text-muted-foreground">
            Updated {formatRelativeTime(task.updatedAt ?? task.createdAt)} · created{" "}
            {formatRelativeTime(task.createdAt)}
          </p>
          {task.requireApprovalFor.length ? (
            <p className="text-xs text-muted-foreground">
              Asks before {task.requireApprovalFor.join(", ")}
            </p>
          ) : null}
        </div>
      </SidebarSection>
    </div>
  );
}
