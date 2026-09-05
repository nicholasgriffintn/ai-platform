import { Badge, Button, ButtonLink, TextLink } from "@ngriffin_uk/polychat-component-ui";
import type {
  Goal,
  GoalEvidenceStatus,
  ProjectFlow,
  ProjectTask,
  ProjectTaskActivityTimeline,
  ProjectTaskPlanEvidence,
} from "@ngriffin_uk/polychat-schemas";
import {
  isProjectTaskAwaitingInput,
  isProjectTaskRetryable,
  isTerminalProjectTaskStatus,
  projectTaskBlockedReasonLabels,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import {
  AlertTriangle,
  Check,
  Circle,
  MessageSquareText,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { isTaskCriterionMet } from "./task-evidence";
import { TaskActivityTimeline as TaskActivityTimelineView } from "./TaskActivityTimeline";
import { TaskStageEvidence } from "./TaskStageEvidence";
import { TaskStatusBadge } from "./TaskStatusBadge";

export interface TaskDetailProps {
  task: ProjectTask;
  goal: Goal | null;
  activity: ProjectTaskActivityTimeline;
  plan: ProjectTaskPlanEvidence;
  flow: ProjectFlow | null;
  members: { userId: number; name: string | null }[];
  agents: { id: string; name: string }[];
  blockedBy: ProjectTask[];
  conversationHref: string | null;
  taskHref: (task: ProjectTask) => string;
  runHref: (conversationId: string, runId: string) => string;
  outputHref: (outputId: string) => string;
  isBusy?: boolean;
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className="text-sm text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function Aside({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 border-t border-zinc-200 py-3 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <p className="text-[11px] tracking-wide text-zinc-500 uppercase">{label}</p>
      <div className="text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </div>
  );
}

export function TaskDetail({
  task,
  goal,
  activity,
  plan,
  flow,
  members,
  agents,
  blockedBy,
  conversationHref,
  taskHref,
  runHref,
  outputHref,
  isBusy = false,
  onRun,
  onAccept,
  onCancel,
  onReopen,
  onDelete,
  renderProgressSummary,
}: TaskDetailProps) {
  const owner = members.find((member) => member.userId === task.assigneeUserId);
  const effectiveFlow = task.flowSnapshot ?? flow;
  const stage = effectiveFlow?.stages.find((candidate) => candidate.id === task.stageId);
  const agentId = stage?.agentId ?? task.runner?.agentId;
  const agent = agents.find((candidate) => candidate.id === agentId);
  const isFinished = isTerminalProjectTaskStatus(task.status);
  const hasExecutionEvidence = Boolean(
    task.status === "done" || task.runId || task.completions.length > 0,
  );
  const canReopen = isFinished && !hasExecutionEvidence;
  const canRetry = isProjectTaskRetryable(task) && plan.resume.supported;
  const needsInput = isProjectTaskAwaitingInput(task);
  const evidence = goal?.evidence ?? [];
  const latestCompletion = task.completions.at(-1) ?? null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} />
          {stage && <Badge variant="outline">{stage.name}</Badge>}
          {task.source === "model" && <Badge variant="outline">Drafted by assistant</Badge>}
        </div>

        {task.status === "blocked" && task.blockedReason && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{projectTaskBlockedReasonLabels[task.blockedReason]}</p>
              {task.blockedDetail && <p className="mt-0.5">{task.blockedDetail}</p>}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {task.status === "review" && (
            <Button
              variant="primary"
              icon={<Check size={14} />}
              onClick={onAccept}
              disabled={isBusy}
            >
              Approve result
            </Button>
          )}
          {task.status === "backlog" && (
            <Button variant="primary" icon={<Play size={14} />} onClick={onRun} disabled={isBusy}>
              Run
            </Button>
          )}
          {canRetry && (
            <Button variant="secondary" icon={<Play size={14} />} onClick={onRun} disabled={isBusy}>
              Run again
            </Button>
          )}
          {conversationHref && task.status === "done" ? (
            <ButtonLink
              href={conversationHref}
              variant="primary"
              icon={<MessageSquareText size={14} />}
              className="no-underline hover:!no-underline"
            >
              View result
            </ButtonLink>
          ) : null}
          {conversationHref && task.status !== "done" ? (
            <ButtonLink
              href={conversationHref}
              variant={needsInput ? "primary" : "outline"}
              icon={<MessageSquareText size={14} />}
              className="no-underline hover:!no-underline"
            >
              {needsInput ? "Answer questions" : "Open conversation"}
            </ButtonLink>
          ) : null}
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Done when</h2>
          {task.acceptanceCriteria.length > 0 ? (
            <ul className="space-y-2">
              {task.acceptanceCriteria.map((criterion) => {
                const isMet = isTaskCriterionMet(task.status, criterion.text, evidence);

                return (
                  <li key={criterion.id} className="flex items-start gap-2 text-sm">
                    {isMet ? (
                      <Check
                        size={14}
                        className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-label={`Met: ${criterion.text}`}
                      />
                    ) : (
                      <Circle
                        size={14}
                        className="mt-0.5 shrink-0 text-zinc-400"
                        aria-label={`Not yet met: ${criterion.text}`}
                      />
                    )}
                    <span>{criterion.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              No acceptance criteria, so the goal has nothing to check itself against.
            </p>
          )}
        </section>

        {latestCompletion ? (
          <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Latest result
              </h2>
              <Badge
                variant={latestCompletion.approval.status === "approved" ? "success" : "warning"}
              >
                {latestCompletion.approval.status === "approved"
                  ? latestCompletion.approval.mode === "automated"
                    ? "Automatically approved"
                    : "Approved"
                  : "Awaiting approval"}
              </Badge>
            </div>
            {latestCompletion.output ? (
              <div className="text-sm leading-6 text-zinc-900 dark:text-zinc-100">
                {renderProgressSummary ? (
                  renderProgressSummary(latestCompletion.output)
                ) : (
                  <p className="whitespace-pre-wrap">{latestCompletion.output}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                This stage completed without a written result. Open the conversation to inspect its
                tool evidence.
              </p>
            )}
          </section>
        ) : null}

        <TaskStageEvidence plan={plan} runHref={runHref} outputHref={outputHref} />

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              What happened
            </h2>
            {goal && (
              <span className="text-xs text-zinc-500">
                {goal.iteration_count} iteration{goal.iteration_count === 1 ? "" : "s"}
                {goal.tokens_spent > 0 ? ` · ${goal.tokens_spent.toLocaleString()} tokens` : ""}
              </span>
            )}
          </div>

          <TaskActivityTimelineView timeline={activity} renderDetail={renderProgressSummary} />

          {goal?.stopped_reason && goal.status !== "completed" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Stopped: {goal.stopped_reason}
            </p>
          )}
        </section>

        {evidence.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Evidence it gave
            </h2>
            <ul className="space-y-3">
              {evidence.map((entry) => (
                <li
                  key={`${entry.claim}:${entry.evidence_surface}`}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-zinc-900 dark:text-zinc-100">{entry.claim}</p>
                    <Badge variant={EVIDENCE_BADGE_VARIANT[entry.status]}>
                      {EVIDENCE_STATUS_LABEL[entry.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{entry.route}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">Where: {entry.evidence_surface}</p>
                  {entry.remaining_uncertainty && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Still unproven: {entry.remaining_uncertainty}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="min-w-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Fact label="Owner" value={owner?.name ?? "Nobody yet"} />
          <Fact label="Active agent" value={agent?.name ?? "Project default"} />
          <Fact label="Stage" value={stage?.name ?? "No pipeline stage"} />
          <Fact
            label="Last activity"
            value={formatRelativeTime(task.updatedAt ?? task.createdAt)}
          />
        </div>

        <div className="mt-4">
          {task.expectedOutput ? (
            <Aside label="Expected output">{task.expectedOutput}</Aside>
          ) : null}
          <Aside label="Approval gates">
            {task.requireApprovalFor.length
              ? task.requireApprovalFor.join(", ")
              : "Use the selected agent and stage policy"}
          </Aside>
          <Aside label="Run budget">
            {task.tokenBudget
              ? `${task.tokensSpent.toLocaleString()} of ${task.tokenBudget.toLocaleString()} tokens used`
              : `${task.tokensSpent.toLocaleString()} tokens used`}
          </Aside>
          {task.context?.notes && <Aside label="Context">{task.context.notes}</Aside>}
          {task.constraints?.notes ? (
            <Aside label="Constraints">{task.constraints.notes}</Aside>
          ) : null}
          <Aside label="Task management">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500">
                  {canReopen
                    ? "Reopen returns this untouched task to the backlog."
                    : isFinished
                      ? "Executed plans keep their evidence. Create a new task to run the work again."
                      : "Cancel stops this task but keeps its conversation and history so it can be reopened."}
                </p>
                {canReopen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RotateCcw size={13} />}
                    className="mt-2"
                    onClick={onReopen}
                    disabled={isBusy}
                  >
                    Reopen task
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={onCancel}
                    disabled={isBusy}
                  >
                    Cancel task
                  </Button>
                )}
              </div>
              <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500">
                  {hasExecutionEvidence
                    ? "Executed plans stay in project history with their run and result evidence."
                    : "Delete removes this unstarted task from the project."}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  className="mt-2 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  onClick={onDelete}
                  disabled={isBusy || task.status === "running" || hasExecutionEvidence}
                >
                  Delete task
                </Button>
              </div>
            </div>
          </Aside>
          {blockedBy.length > 0 && (
            <Aside label="Blocked by">
              <ul className="space-y-1">
                {blockedBy.map((dependency) => (
                  <li key={dependency.id} className="flex items-start gap-1.5">
                    {dependency.status === "done" ? (
                      <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle size={13} className="mt-0.5 shrink-0 text-zinc-400" />
                    )}
                    <TextLink href={taskHref(dependency)} size="xs">
                      {dependency.objective}
                    </TextLink>
                  </li>
                ))}
              </ul>
            </Aside>
          )}
        </div>
      </aside>
    </div>
  );
}
