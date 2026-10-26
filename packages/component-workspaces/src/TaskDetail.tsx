import { TextLink } from "@ngriffin_uk/polychat-component-ui";
import type {
  AnswerStandupInput,
  Goal,
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
} from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { TaskBreakdownSection } from "./TaskBreakdown";
import {
  TaskDoneWhen,
  TaskHeader,
  TaskLatestResult,
  TaskRunHistory,
  TaskSideFacts,
} from "./TaskDetailParts";
import {
  TaskCaseSection,
  TaskEscalationBanner,
  TaskLinks,
  TaskPropertiesPanel,
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
  onAcceptBreakdown: (revision: number) => void;
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
  const stage = effectiveFlow?.stages.find((candidate) => candidate.id === task.stageId) ?? null;
  const isFinished = isTerminalProjectTaskStatus(task.status);
  const hasExecutionEvidence = Boolean(
    task.status === "done" || task.runId || task.completions.length > 0,
  );
  const canReopen = isFinished && !hasExecutionEvidence;
  const canRetry = isProjectTaskRetryable(task) && plan.resume.supported;
  const needsInput = isProjectTaskAwaitingInput(task);
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

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-8">
          <TaskHeader
            task={task}
            stage={stage}
            taskHref={taskHref}
            actions={{
              canRetry,
              canReopen,
              isFinished,
              hasExecutionEvidence,
              needsInput,
              conversationHref,
              isBusy,
              onAccept,
              onRun,
              onCancel,
              onReopen,
              onDelete,
              onSendAgain: work.onSendAgain,
              onRaiseCase: () => setDialog("case"),
              onEscalate: () => setDialog("escalate"),
            }}
          />

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
            <TaskDoneWhen task={task} evidence={goal?.evidence ?? []} />
          ) : null}

          {task.details.breakdown ? (
            <TaskBreakdownSection
              breakdown={task.details.breakdown}
              directory={work.directory}
              isBusy={isBusy}
              onAccept={work.onAcceptBreakdown}
            />
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
            <TaskLatestResult
              completion={latestCompletion}
              renderProgressSummary={renderProgressSummary}
            />
          ) : null}

          <TaskThread
            thread={work.thread}
            directory={work.directory}
            isBusy={isBusy}
            onComment={work.onComment}
            renderBody={renderProgressSummary}
          />

          {task.kind === "task" ? (
            <TaskRunHistory
              task={task}
              goal={goal}
              plan={plan}
              activity={activity}
              runHref={runHref}
              outputHref={outputHref}
              renderProgressSummary={renderProgressSummary}
            />
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
            <TaskSideFacts task={task} stage={stage} blockedBy={blockedBy} taskHref={taskHref} />
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
