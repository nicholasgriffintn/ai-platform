import {
  Badge,
  Button,
  ButtonLink,
  DropdownMenu,
  DropdownMenuItem,
  TextLink,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  AnswerStandupInput,
  Goal,
  GoalEvidenceStatus,
  ProjectFlow,
  ProjectTask,
  ProjectTaskActivityTimeline,
  ProjectTaskLinked,
  ProjectTaskPlanEvidence,
  ProjectTaskPriority,
  ProjectTaskSummary,
  ProjectTaskThreadPost,
  WorkActor,
} from "@ngriffin_uk/polychat-schemas";
import {
  isProjectTaskAwaitingInput,
  isProjectTaskRetryable,
  isTerminalProjectTaskStatus,
  projectTaskBlockedReasonLabels,
  projectTaskPriorityLabels,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import {
  AlertTriangle,
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
import { useState } from "react";

import { isTaskCriterionMet } from "./task-evidence";
import { TaskActivityTimeline as TaskActivityTimelineView } from "./TaskActivityTimeline";
import { TaskPlanRecord } from "./TaskPlanRecord";
import { TaskStageEvidence } from "./TaskStageEvidence";
import { TaskStatusBadge } from "./TaskStatusBadge";
import {
  TaskCaseSection,
  TaskEscalationBanner,
  TaskLinks,
  TaskPropertiesPanel,
  TaskSection,
  TaskStandupSection,
  TaskSubTasks,
  TaskTextDialog,
  TaskThread,
} from "./TaskWorkSections";
import type { WorkDirectory } from "./work-actors";

export interface TaskWorkProps {
  directory: WorkDirectory;
  subTasks: readonly ProjectTaskSummary[];
  links: readonly ProjectTaskLinked[];
  thread: readonly ProjectTaskThreadPost[];
  currentUserId: number | null;
  standupDraft: AnswerStandupInput | null;
  onAssign: (owner: WorkActor | null) => void;
  onSetReviewer: (reviewer: WorkActor) => void;
  onSetPriority: (priority: ProjectTaskPriority) => void;
  onSetDueAt: (dueAt: string | null) => void;
  onComment: (body: string) => Promise<unknown>;
  onAddSubTask: (objective: string) => Promise<unknown>;
  onRaiseCase: (title: string) => Promise<unknown>;
  onEscalate: (reason: string) => Promise<unknown>;
  onResolveCase: (resolution: string) => void;
  onSendCaseReply: (body: string) => Promise<unknown>;
  onClearEscalation: () => void;
  onSendAgain: () => void;
  onAnswerStandup: (input: AnswerStandupInput) => void;
  onUnlink: (linkId: string) => void;
}

export interface TaskDetailProps {
  task: ProjectTask;
  goal: Goal | null;
  activity: ProjectTaskActivityTimeline;
  plan: ProjectTaskPlanEvidence;
  flow: ProjectFlow | null;
  blockedBy: ProjectTask[];
  conversationHref: string | null;
  originConversationHref: string | null;
  taskHref: (task: Pick<ProjectTask, "id" | "projectId">) => string;
  runHref: (conversationId: string, runId: string) => string;
  outputHref: (outputId: string) => string;
  isBusy?: boolean;
  work: TaskWorkProps;
  onRun: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onReopen: () => void;
  onDelete: () => void;
  renderProgressSummary?: (summary: string) => React.ReactNode;
}

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

function SideFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 text-foreground">{children}</div>
    </div>
  );
}

export function TaskDetail({
  task,
  goal,
  activity,
  plan,
  flow,
  blockedBy,
  conversationHref,
  originConversationHref,
  taskHref,
  runHref,
  outputHref,
  isBusy = false,
  work,
  onRun,
  onAccept,
  onCancel,
  onReopen,
  onDelete,
  renderProgressSummary,
}: TaskDetailProps) {
  const [dialog, setDialog] = useState<"case" | "escalate" | null>(null);
  const effectiveFlow = task.flowSnapshot ?? flow;
  const stage = effectiveFlow?.stages.find((candidate) => candidate.id === task.stageId);
  const isFinished = isTerminalProjectTaskStatus(task.status);
  const hasExecutionEvidence = Boolean(
    task.status === "done" || task.runId || task.completions.length > 0,
  );
  const canReopen = isFinished && !hasExecutionEvidence;
  const canRetry = isProjectTaskRetryable(task) && plan.resume.supported;
  const needsInput = isProjectTaskAwaitingInput(task);
  const evidence = goal?.evidence ?? [];
  const latestCompletion = task.completions.at(-1) ?? null;
  const standup = task.details.standup;
  const awaitingMyStandup = Boolean(
    standup &&
    !standup.summary &&
    work.currentUserId !== null &&
    standup.participants.some(
      (participant) =>
        participant.actor.type === "person" && participant.actor.userId === work.currentUserId,
    ) &&
    !standup.answers.some(
      (answer) => answer.actor.type === "person" && answer.actor.userId === work.currentUserId,
    ),
  );
  const runCount = plan.stages.reduce((sum, entry) => sum + entry.attempts.length, 0);

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-8">
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
              {task.source === "model" ? (
                <Badge variant="outline">Drafted by a teammate</Badge>
              ) : null}
              <span className="flex-1" />
              {task.status === "review" ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Check size={14} />}
                  onClick={onAccept}
                  disabled={isBusy}
                >
                  Approve result
                </Button>
              ) : null}
              {task.status === "backlog" && task.kind === "task" ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Play size={14} />}
                  onClick={onRun}
                  disabled={isBusy}
                >
                  Run
                </Button>
              ) : null}
              {canRetry ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Play size={14} />}
                  onClick={onRun}
                  disabled={isBusy}
                >
                  Run again
                </Button>
              ) : null}
              {conversationHref ? (
                <ButtonLink
                  href={conversationHref}
                  size="sm"
                  variant={needsInput ? "primary" : "outline"}
                  icon={<MessageSquareText size={14} />}
                  className="no-underline hover:!no-underline"
                >
                  {needsInput ? "Answer questions" : "Open run"}
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
                {!isFinished ? (
                  <DropdownMenuItem
                    icon={<CircleDot size={15} />}
                    onClick={() => setDialog("case")}
                  >
                    Raise a case from this task
                  </DropdownMenuItem>
                ) : null}
                {!isFinished ? (
                  <DropdownMenuItem icon={<Flag size={15} />} onClick={() => setDialog("escalate")}>
                    Escalate
                  </DropdownMenuItem>
                ) : null}
                {task.status === "queued" || task.status === "running" ? (
                  <DropdownMenuItem icon={<RefreshCw size={15} />} onClick={work.onSendAgain}>
                    Send to the queue again
                  </DropdownMenuItem>
                ) : null}
                {canReopen ? (
                  <DropdownMenuItem icon={<RotateCcw size={15} />} onClick={onReopen}>
                    Reopen
                  </DropdownMenuItem>
                ) : !isFinished ? (
                  <DropdownMenuItem icon={<XCircle size={15} />} onClick={onCancel}>
                    Cancel task
                  </DropdownMenuItem>
                ) : null}
                {!hasExecutionEvidence && task.status !== "running" ? (
                  <DropdownMenuItem
                    icon={<Trash2 size={15} />}
                    className="text-failure"
                    onClick={onDelete}
                  >
                    Delete task
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenu>
            </div>
            {isFinished && hasExecutionEvidence ? (
              <p className="text-xs text-muted-foreground">
                Executed plans keep their evidence. Create a new task to run the work again.
              </p>
            ) : null}
          </header>

          {task.details.escalation ? (
            <TaskEscalationBanner
              escalation={task.details.escalation}
              directory={work.directory}
              isBusy={isBusy}
              onClear={work.onClearEscalation}
            />
          ) : null}

          {task.status === "blocked" && task.blockedReason ? (
            <div className="flex items-start gap-2 rounded-lg border border-attention/45 bg-attention/12 p-3 text-sm text-attention">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{projectTaskBlockedReasonLabels[task.blockedReason]}</p>
                {task.blockedDetail ? <p className="mt-0.5">{task.blockedDetail}</p> : null}
              </div>
            </div>
          ) : null}

          {task.description ? (
            <p className="text-sm leading-6 whitespace-pre-wrap text-foreground">
              {task.description}
            </p>
          ) : null}

          {originConversationHref ? (
            <p className="text-sm text-muted-foreground">
              Filed from{" "}
              <TextLink href={originConversationHref}>the conversation it came from</TextLink>.
            </p>
          ) : null}

          {task.details.case ? (
            <TaskCaseSection
              caseDetail={task.details.case}
              directory={work.directory}
              isBusy={isBusy}
              onResolve={work.onResolveCase}
              onSendReply={work.onSendCaseReply}
            />
          ) : null}

          {standup ? (
            <TaskStandupSection
              standup={standup}
              awaitingMe={awaitingMyStandup}
              draft={work.standupDraft}
              isBusy={isBusy}
              onAnswer={work.onAnswerStandup}
            />
          ) : null}

          {task.kind === "task" ? (
            <TaskSection title="Done when">
              {task.acceptanceCriteria.length > 0 ? (
                <ul className="space-y-2">
                  {task.acceptanceCriteria.map((criterion) => {
                    const isMet = isTaskCriterionMet(task.status, criterion.text, evidence);

                    return (
                      <li key={criterion.id} className="flex items-start gap-2 text-sm">
                        {isMet ? (
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
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No acceptance criteria yet, so the run has nothing to check itself against.
                </p>
              )}
            </TaskSection>
          ) : null}

          <TaskSubTasks
            subTasks={work.subTasks}
            directory={work.directory}
            taskHref={taskHref}
            canAdd={!isFinished && task.kind === "task"}
            isBusy={isBusy}
            onAdd={work.onAddSubTask}
          />

          <TaskLinks links={work.links} taskHref={taskHref} onUnlink={work.onUnlink} />

          {latestCompletion ? (
            <TaskSection
              title="Latest result"
              meta={
                latestCompletion.approval.status === "approved"
                  ? latestCompletion.approval.mode === "automated"
                    ? "Approved automatically"
                    : "Approved"
                  : "Awaiting approval"
              }
            >
              <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-6">
                {latestCompletion.output ? (
                  renderProgressSummary ? (
                    renderProgressSummary(latestCompletion.output)
                  ) : (
                    <p className="whitespace-pre-wrap">{latestCompletion.output}</p>
                  )
                ) : (
                  <p className="text-muted-foreground">
                    This stage finished without a written result. Open the run to see its tool
                    evidence.
                  </p>
                )}
              </div>
            </TaskSection>
          ) : null}

          <TaskThread
            thread={work.thread}
            directory={work.directory}
            isBusy={isBusy}
            onComment={work.onComment}
            renderBody={renderProgressSummary}
          />

          {task.kind === "task" ? (
            <details className="group rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
                <ChevronRight
                  size={14}
                  className="transition-transform group-open:rotate-90"
                  aria-hidden
                />
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
                  <TaskActivityTimelineView
                    timeline={activity}
                    renderDetail={renderProgressSummary}
                  />
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
          ) : null}
        </div>

        <aside className="min-w-0 self-start lg:sticky lg:top-4" aria-label="Task properties">
          <TaskPropertiesPanel
            task={task}
            directory={work.directory}
            isBusy={isBusy}
            onAssign={work.onAssign}
            onSetReviewer={work.onSetReviewer}
            onSetPriority={work.onSetPriority}
            onSetDueAt={work.onSetDueAt}
          >
            <div className="py-2">
              {stage ? <SideFact label="Stage">{stage.name}</SideFact> : null}
              <SideFact label="Updated">
                {formatRelativeTime(task.updatedAt ?? task.createdAt)}
              </SideFact>
              <SideFact label="Budget">
                {task.tokenBudget
                  ? `${task.tokensSpent.toLocaleString()} of ${task.tokenBudget.toLocaleString()} tokens`
                  : `${task.tokensSpent.toLocaleString()} tokens`}
              </SideFact>
              {task.requireApprovalFor.length ? (
                <SideFact label="Asks before">{task.requireApprovalFor.join(", ")}</SideFact>
              ) : null}
            </div>
            {task.expectedOutput || task.context?.notes || task.constraints?.notes ? (
              <div className="space-y-3 py-3 text-sm">
                {task.expectedOutput ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Expected output</p>
                    <p>{task.expectedOutput}</p>
                  </div>
                ) : null}
                {task.context?.notes ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Context</p>
                    <p>{task.context.notes}</p>
                  </div>
                ) : null}
                {task.constraints?.notes ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Constraints</p>
                    <p>{task.constraints.notes}</p>
                  </div>
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
          </TaskPropertiesPanel>
        </aside>
      </div>

      <TaskTextDialog
        open={dialog === "case"}
        title="Raise a case"
        description="Send a problem you found to the project's Triage. It stays linked to this task."
        label="What's wrong?"
        submitText="Raise case"
        isBusy={isBusy}
        onOpenChange={(open) => setDialog(open ? "case" : null)}
        onSubmit={work.onRaiseCase}
      />
      <TaskTextDialog
        open={dialog === "escalate"}
        title="Escalate"
        description="Ask the person responsible for this task for a decision. It shows in their Inbox."
        label="What decision is needed?"
        submitText="Escalate"
        isBusy={isBusy}
        onOpenChange={(open) => setDialog(open ? "escalate" : null)}
        onSubmit={work.onEscalate}
      />
    </>
  );
}
