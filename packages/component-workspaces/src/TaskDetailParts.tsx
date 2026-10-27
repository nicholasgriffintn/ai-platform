import {
  Badge,
  ButtonLink,
  DropdownMenu,
  DropdownMenuItem,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  Goal,
  GoalEvidenceEntry,
  GoalEvidenceStatus,
  ProjectTask,
  ProjectTaskActivityTimeline,
  ProjectTaskPlanEvidence,
} from "@ngriffin_uk/polychat-schemas";
import {
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  Ellipsis,
  Flag,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import { isTaskCriterionMet } from "./task-evidence";
import { TaskActivityTimeline as TaskActivityTimelineView } from "./TaskActivityTimeline";
import { TaskPlanRecord } from "./TaskPlanRecord";
import { TaskStageEvidence } from "./TaskStageEvidence";
import { TaskSection } from "./TaskWorkSections";

const EVIDENCE_BADGE_VARIANT: Record<
  GoalEvidenceStatus,
  "success" | "warning" | "outline" | "destructive"
> = {
  confirmed: "success",
  approximate: "warning",
  supporting: "outline",
  blocked: "destructive",
};

const EVIDENCE_STATUS_LABEL: Record<GoalEvidenceStatus, string> = {
  confirmed: "Confirmed",
  approximate: "Approximate",
  supporting: "Supporting",
  blocked: "Blocked",
};

export interface TaskHeaderActions {
  canReopen: boolean;
  isFinished: boolean;
  hasExecutionEvidence: boolean;
  needsInput: boolean;
  conversationHref: string | null;
  onCancel: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onSendAgain: () => void;
  onRaiseCase: () => void;
  onEscalate: () => void;
}

export function TaskActionsMenu({
  task,
  actions,
}: {
  task: ProjectTask;
  actions: TaskHeaderActions;
}) {
  return (
    <div className="flex items-center gap-1">
      {actions.conversationHref && !actions.needsInput ? (
        <ButtonLink
          href={actions.conversationHref}
          size="sm"
          variant="ghost"
          icon={<MessageSquareText size={14} />}
          className="no-underline hover:!no-underline"
        >
          Open run
        </ButtonLink>
      ) : null}
      <DropdownMenu
        position="bottom"
        menuClassName="!left-auto right-0 w-56"
        trigger={<Ellipsis size={16} />}
        buttonProps={{
          variant: "icon",
          className: "h-8 w-8 p-1.5",
          "aria-label": "More task actions",
          title: "More task actions",
        }}
      >
        {!actions.isFinished ? (
          <DropdownMenuItem icon={<CircleDot size={15} />} onClick={actions.onRaiseCase}>
            Raise a case from this task
          </DropdownMenuItem>
        ) : null}
        {!actions.isFinished ? (
          <DropdownMenuItem icon={<Flag size={15} />} onClick={actions.onEscalate}>
            Escalate
          </DropdownMenuItem>
        ) : null}
        {task.status === "queued" || task.status === "running" ? (
          <DropdownMenuItem icon={<RefreshCw size={15} />} onClick={actions.onSendAgain}>
            Send to the queue again
          </DropdownMenuItem>
        ) : null}
        {actions.canReopen ? (
          <DropdownMenuItem icon={<RotateCcw size={15} />} onClick={actions.onReopen}>
            Reopen
          </DropdownMenuItem>
        ) : !actions.isFinished ? (
          <DropdownMenuItem icon={<XCircle size={15} />} onClick={actions.onCancel}>
            Cancel task
          </DropdownMenuItem>
        ) : null}
        {!actions.hasExecutionEvidence && task.status !== "running" ? (
          <DropdownMenuItem
            icon={<Trash2 size={15} />}
            className="text-failure"
            onClick={actions.onDelete}
          >
            Delete task
          </DropdownMenuItem>
        ) : null}
      </DropdownMenu>
    </div>
  );
}

export function TaskMeta({ task }: { task: ProjectTask }) {
  if (task.kind === "task" && task.source !== "model") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.kind !== "task" ? (
        <Badge variant="info">{task.kind === "case" ? "Case" : "Standup"}</Badge>
      ) : null}
      {task.source === "model" ? <Badge variant="muted">Drafted by a teammate</Badge> : null}
    </div>
  );
}

export function TaskDoneWhen({
  task,
  evidence,
}: {
  task: ProjectTask;
  evidence: readonly GoalEvidenceEntry[];
}) {
  if (task.acceptanceCriteria.length === 0) {
    return null;
  }

  const met = task.acceptanceCriteria.filter((criterion) =>
    isTaskCriterionMet(task.status, criterion.text, evidence),
  ).length;

  return (
    <TaskSection title="Done when" meta={`${met} of ${task.acceptanceCriteria.length} met`}>
      <ul className="space-y-2">
        {task.acceptanceCriteria.map((criterion) => (
          <li key={criterion.id} className="flex items-start gap-2 text-sm">
            {isTaskCriterionMet(task.status, criterion.text, evidence) ? (
              <Check
                size={14}
                className="mt-0.5 shrink-0 text-success"
                aria-label={`Met: ${criterion.text}`}
              />
            ) : (
              <Circle
                size={14}
                className="mt-0.5 shrink-0 text-muted-foreground"
                aria-label={`Not yet met: ${criterion.text}`}
              />
            )}
            <span>{criterion.text}</span>
          </li>
        ))}
      </ul>
    </TaskSection>
  );
}

export function TaskLatestResult({
  completion,
  renderProgressSummary,
}: {
  completion: ProjectTask["completions"][number];
  renderProgressSummary?: (summary: string) => React.ReactNode;
}) {
  return (
    <TaskSection
      title="Latest result"
      meta={
        completion.approval.status === "approved"
          ? completion.approval.mode === "automated"
            ? "Approved automatically"
            : "Approved"
          : "Awaiting approval"
      }
    >
      <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-6">
        {completion.output ? (
          renderProgressSummary ? (
            renderProgressSummary(completion.output)
          ) : (
            <p className="whitespace-pre-wrap">{completion.output}</p>
          )
        ) : (
          <p className="text-muted-foreground">
            This stage finished without a written result. Open the run to see its tool evidence.
          </p>
        )}
      </div>
    </TaskSection>
  );
}

export function TaskRunHistory({
  task,
  goal,
  plan,
  activity,
  runHref,
  outputHref,
  renderProgressSummary,
}: {
  task: ProjectTask;
  goal: Goal | null;
  plan: ProjectTaskPlanEvidence;
  activity: ProjectTaskActivityTimeline;
  runHref: (conversationId: string, runId: string) => string;
  outputHref: (outputId: string) => string;
  renderProgressSummary?: (summary: string) => React.ReactNode;
}) {
  const evidence = goal?.evidence ?? [];
  const runCount = plan.stages.reduce((sum, entry) => sum + entry.attempts.length, 0);

  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden />
        Run history
        <span className="font-normal text-muted-foreground">
          {runCount} {runCount === 1 ? "run" : "runs"}
          {goal?.tokens_spent ? ` · ${goal.tokens_spent.toLocaleString()} tokens` : ""}
        </span>
      </summary>
      <div className="space-y-8 border-t border-border p-4">
        <TaskPlanRecord task={task} />
        <TaskStageEvidence plan={plan} runHref={runHref} outputHref={outputHref} />
        <TaskSection title="What happened">
          <TaskActivityTimelineView timeline={activity} renderDetail={renderProgressSummary} />
          {goal?.stopped_reason && goal.status !== "completed" ? (
            <p className="text-sm text-muted-foreground">Stopped: {goal.stopped_reason}</p>
          ) : null}
        </TaskSection>
        {evidence.length > 0 ? (
          <TaskSection title="Evidence it gave">
            <ul className="space-y-3">
              {evidence.map((entry) => (
                <li
                  key={`${entry.claim}:${entry.evidence_surface}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-foreground">{entry.claim}</p>
                    <Badge variant={EVIDENCE_BADGE_VARIANT[entry.status]}>
                      {EVIDENCE_STATUS_LABEL[entry.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.route}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Where: {entry.evidence_surface}
                  </p>
                  {entry.remaining_uncertainty ? (
                    <p className="mt-1 text-xs text-attention">
                      Still unproven: {entry.remaining_uncertainty}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </TaskSection>
        ) : null}
      </div>
    </details>
  );
}
