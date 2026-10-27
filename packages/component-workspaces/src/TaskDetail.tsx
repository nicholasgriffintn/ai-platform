import { PageShellHeader, TextLink } from "@ngriffin_uk/polychat-component-ui";
import type {
  AnswerStandupInput,
  Goal,
  ProjectFlow,
  ProjectTask,
  ProjectTaskActivityTimeline,
  ProjectTaskLinked,
  ProjectTaskPlanEvidence,
  ProjectTaskPriority,
  ProjectTaskStageOutput,
  ProjectTaskSummary,
  ProjectTaskThreadPost,
  WorkActor,
} from "@ngriffin_uk/polychat-schemas";
import {
  isProjectTaskAwaitingInput,
  isProjectTaskRetryable,
  isTerminalProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { TaskBreakdownSection } from "./TaskBreakdown";
import { TaskCallout } from "./TaskCallout";
import {
  TaskActionsMenu,
  TaskDoneWhen,
  TaskLatestResult,
  TaskMeta,
  TaskRunHistory,
} from "./TaskDetailParts";
import { TaskDescription, TaskTitle } from "./TaskEditable";
import { TaskOutputs } from "./TaskOutputs";
import { TaskSidebar } from "./TaskSidebar";
import {
  TaskCaseSection,
  TaskEscalationBanner,
  TaskLinks,
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
  onRename: (objective: string) => void;
  onDescribe: (description: string | null) => void;
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
  title: string;
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
  outputs: readonly ProjectTaskStageOutput[];
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
  title,
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
  outputs,
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
  const canEdit = !isFinished && !isBusy;

  return (
    <>
      <PageShellHeader
        title={title}
        actionContent={
          <TaskActionsMenu
            task={task}
            actions={{
              canReopen,
              isFinished,
              hasExecutionEvidence,
              needsInput,
              conversationHref,
              onCancel,
              onReopen,
              onDelete,
              onSendAgain: work.onSendAgain,
              onRaiseCase: () => setDialog("case"),
              onEscalate: () => setDialog("escalate"),
            }}
          />
        }
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="min-w-0 lg:pr-10">
          <div className="mx-auto max-w-3xl space-y-8 pb-16">
            <header className="space-y-3">
              <TaskMeta task={task} />
              <TaskTitle value={task.objective} canEdit={canEdit} onSave={work.onRename} />
              <TaskDescription
                value={task.description ?? ""}
                canEdit={canEdit}
                onSave={(description) => work.onDescribe(description || null)}
              />
              {isFinished && hasExecutionEvidence ? (
                <p className="text-xs text-muted-foreground">
                  Executed plans keep their evidence. Create a new task to run the work again.
                </p>
              ) : null}
              {originConversationHref ? (
                <p className="text-xs text-muted-foreground">
                  Filed from{" "}
                  <TextLink href={originConversationHref} size="xs">
                    the conversation it came from
                  </TextLink>
                </p>
              ) : null}
            </header>

            <TaskCallout
              task={task}
              needsInput={needsInput}
              canRetry={canRetry}
              conversationHref={conversationHref}
              isBusy={isBusy}
              onAccept={onAccept}
              onRun={onRun}
            />

            {task.details.escalation ? (
              <TaskEscalationBanner
                escalation={task.details.escalation}
                directory={work.directory}
                isBusy={isBusy}
                onClear={work.onClearEscalation}
              />
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

            <TaskOutputs outputs={outputs} outputHref={outputHref} />

            {task.kind === "task" ? (
              <TaskDoneWhen task={task} evidence={goal?.evidence ?? []} />
            ) : null}

            {latestCompletion ? (
              <TaskLatestResult
                completion={latestCompletion}
                renderProgressSummary={renderProgressSummary}
              />
            ) : null}

            <TaskLinks links={work.links} taskHref={taskHref} onUnlink={work.onUnlink} />

            <TaskThread
              thread={work.thread}
              directory={work.directory}
              isBusy={isBusy}
              onComment={work.onComment}
              renderBody={renderProgressSummary}
            />

            {task.kind === "task" && hasExecutionEvidence ? (
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
        </article>

        <aside
          className="min-w-0 border-t border-border pt-6 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
          aria-label="Task properties"
        >
          <TaskSidebar
            task={task}
            stageName={stage?.name ?? null}
            directory={work.directory}
            blockedBy={blockedBy}
            taskHref={taskHref}
            isBusy={isBusy}
            onAssign={work.onAssign}
            onSetReviewer={work.onSetReviewer}
            onSetPriority={work.onSetPriority}
            onSetDueAt={work.onSetDueAt}
          />
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
