import {
  Badge,
  Button,
  ButtonLink,
  DropdownMenu,
  DropdownMenuItem,
  TextLink,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  Goal,
  GoalEvidenceEntry,
  GoalEvidenceStatus,
  ProjectFlowStage,
  ProjectTask,
  ProjectTaskActivityTimeline,
  ProjectTaskPlanEvidence,
} from "@ngriffin_uk/polychat-schemas";
import { projectTaskPriorityLabels } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import {
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  Ellipsis,
  Flag,
  MessageSquareText,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import { isTaskCriterionMet } from "./task-evidence";
import { TaskActivityTimeline as TaskActivityTimelineView } from "./TaskActivityTimeline";
import { TaskPlanRecord } from "./TaskPlanRecord";
import { TaskStageEvidence } from "./TaskStageEvidence";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { PropertyRow, TaskSection } from "./TaskWorkSections";

type TaskHref = (task: Pick<ProjectTask, "id" | "projectId">) => string;

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
  canRetry: boolean;
  canReopen: boolean;
  isFinished: boolean;
  hasExecutionEvidence: boolean;
  needsInput: boolean;
  conversationHref: string | null;
  isBusy: boolean;
  onAccept: () => void;
  onRun: () => void;
  onCancel: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onSendAgain: () => void;
  onRaiseCase: () => void;
  onEscalate: () => void;
}

export function TaskHeader({
  task,
  stage,
  taskHref,
  actions,
}: {
  task: ProjectTask;
  stage: ProjectFlowStage | null;
  taskHref: TaskHref;
  actions: TaskHeaderActions;
}) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{task.key ?? task.id.slice(0, 8)}</span>
        {task.parentTaskId ? (
          <>
            <ChevronRight size={12} aria-hidden />
            <TextLink
              href={taskHref({ id: task.parentTaskId, projectId: task.projectId })}
              size="xs"
            >
              Parent task
            </TextLink>
          </>
        ) : null}
        {task.kind !== "task" ? (
          <Badge variant="info">{task.kind === "case" ? "Case" : "Standup"}</Badge>
        ) : null}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
        {task.objective}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        <TaskStatusBadge status={task.status} />
        {stage ? <Badge variant="outline">{stage.name}</Badge> : null}
        {task.priority !== "none" ? (
          <Badge variant={task.priority === "urgent" ? "destructive" : "outline"}>
            {projectTaskPriorityLabels[task.priority]}
          </Badge>
        ) : null}
        {task.source === "model" ? <Badge variant="outline">Drafted by a teammate</Badge> : null}
        <span className="flex-1" />
        {task.status === "review" ? (
          <Button
            size="sm"
            variant="primary"
            icon={<Check size={14} />}
            onClick={actions.onAccept}
            disabled={actions.isBusy}
          >
            Approve result
          </Button>
        ) : null}
        {task.status === "backlog" && task.kind === "task" ? (
          <Button
            size="sm"
            variant="primary"
            icon={<Play size={14} />}
            onClick={actions.onRun}
            disabled={actions.isBusy}
          >
            Run
          </Button>
        ) : null}
        {actions.canRetry ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Play size={14} />}
            onClick={actions.onRun}
            disabled={actions.isBusy}
          >
            Run again
          </Button>
        ) : null}
        {actions.conversationHref ? (
          <ButtonLink
            href={actions.conversationHref}
            size="sm"
            variant={actions.needsInput ? "primary" : "outline"}
            icon={<MessageSquareText size={14} />}
            className="no-underline hover:!no-underline"
          >
            {actions.needsInput ? "Answer questions" : "Open run"}
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
      {actions.isFinished && actions.hasExecutionEvidence ? (
        <p className="text-xs text-muted-foreground">
          Executed plans keep their evidence. Create a new task to run the work again.
        </p>
      ) : null}
    </header>
  );
}

export function TaskDoneWhen({
  task,
  evidence,
}: {
  task: ProjectTask;
  evidence: readonly GoalEvidenceEntry[];
}) {
  return (
    <TaskSection title="Done when">
      {task.acceptanceCriteria.length > 0 ? (
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
      ) : (
        <p className="text-sm text-muted-foreground">
          No acceptance criteria yet, so the run has nothing to check itself against.
        </p>
      )}
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

function TaskNote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{children}</p>
    </div>
  );
}

export function TaskSideFacts({
  task,
  stage,
  blockedBy,
  taskHref,
}: {
  task: ProjectTask;
  stage: ProjectFlowStage | null;
  blockedBy: readonly ProjectTask[];
  taskHref: TaskHref;
}) {
  return (
    <>
      <div className="py-2">
        {stage ? <PropertyRow label="Stage">{stage.name}</PropertyRow> : null}
        <PropertyRow label="Updated">
          {formatRelativeTime(task.updatedAt ?? task.createdAt)}
        </PropertyRow>
        <PropertyRow label="Budget">
          {task.tokenBudget
            ? `${task.tokensSpent.toLocaleString()} of ${task.tokenBudget.toLocaleString()} tokens`
            : `${task.tokensSpent.toLocaleString()} tokens`}
        </PropertyRow>
        {task.requireApprovalFor.length ? (
          <PropertyRow label="Asks before">{task.requireApprovalFor.join(", ")}</PropertyRow>
        ) : null}
      </div>
      {task.expectedOutput || task.context?.notes || task.constraints?.notes ? (
        <div className="space-y-3 py-3 text-sm">
          {task.expectedOutput ? (
            <TaskNote label="Expected output">{task.expectedOutput}</TaskNote>
          ) : null}
          {task.context?.notes ? <TaskNote label="Context">{task.context.notes}</TaskNote> : null}
          {task.constraints?.notes ? (
            <TaskNote label="Constraints">{task.constraints.notes}</TaskNote>
          ) : null}
        </div>
      ) : null}
      {blockedBy.length > 0 ? (
        <div className="py-3">
          <p className="mb-1 text-xs text-muted-foreground">Blocked by</p>
          <ul className="space-y-1 text-sm">
            {blockedBy.map((dependency) => (
              <li key={dependency.id} className="flex items-start gap-1.5">
                {dependency.status === "done" ? (
                  <Check size={13} className="mt-0.5 shrink-0 text-success" />
                ) : (
                  <Circle size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <TextLink href={taskHref(dependency)} size="xs">
                  {dependency.key ? `${dependency.key} ` : ""}
                  {dependency.objective}
                </TextLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
