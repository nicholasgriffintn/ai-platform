import { Button, ButtonLink, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import {
  isProjectTaskAwaitingInput,
  isProjectTaskRetryable,
  projectTaskBlockedReasonLabels,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskStatus,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, sortCopy } from "@ngriffin_uk/polychat-utility-core";
import {
  ArrowRight,
  Bot,
  GitBranch,
  ListChecks,
  MessageSquareText,
  Pause,
  Play,
  Settings2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Fragment, useState } from "react";

import {
  DEFAULT_TASK_QUEUE_FILTERS,
  filterTaskQueue,
  type TaskQueueFilters,
} from "./task-board-filters";
import { TaskBoardFilters } from "./TaskBoardFilters";
import { TaskStatusBadge } from "./TaskStatusBadge";

const NO_PENDING_TASKS: string[] = [];

export interface TaskBoardMemberSummary {
  userId: number;
  name: string | null;
}

export interface TaskBoardAgentSummary {
  id: string;
  name: string;
}

export interface TaskBoardProps {
  tasks: ProjectTask[];
  flow: ProjectFlow | null;
  members: TaskBoardMemberSummary[];
  agents: TaskBoardAgentSummary[];
  pendingTaskIds?: string[];
  taskHref: (task: ProjectTask) => string;
  conversationHref: (task: ProjectTask) => string | null;
  onStartTask: (task: ProjectTask) => void;
  onAcceptTask: (task: ProjectTask) => void;
  onCreateTask: () => void;
  onConfigureFlow: () => void;
  canCreateTask: boolean;
  canManageFlow: boolean;
}

const STATUS_ORDER: Record<ProjectTaskStatus, number> = {
  blocked: 0,
  review: 1,
  running: 2,
  queued: 3,
  backlog: 4,
  done: 5,
  cancelled: 6,
};

function PipelineProgress({ task, flow }: { task: ProjectTask; flow: ProjectFlow | null }) {
  if (!flow) {
    return null;
  }

  const showsCurrentStage =
    task.status === "queued" ||
    task.status === "running" ||
    task.status === "blocked" ||
    task.status === "review";
  const currentStageId = task.stageId ?? (showsCurrentStage ? flow.stages[0]?.id : null);
  const currentIndex = flow.stages.findIndex((stage) => stage.id === currentStageId);
  const isDone = task.status === "done";

  return (
    <div className="flex min-w-0 items-center gap-1" aria-label="Pipeline progress">
      {flow.stages.map((stage, index) => {
        const isComplete =
          isDone || (task.status !== "backlog" && currentIndex >= 0 && index < currentIndex);
        const isCurrent = showsCurrentStage && index === currentIndex;

        return (
          <Fragment key={stage.id}>
            {index > 0 ? (
              <span
                className={`h-px min-w-1 flex-1 ${
                  isDone
                    ? "bg-success"
                    : isComplete || isCurrent
                      ? "bg-active-work"
                      : "bg-selection"
                }`}
              />
            ) : null}
            <span
              title={stage.name}
              aria-current={isCurrent ? "step" : undefined}
              className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                isComplete
                  ? isDone
                    ? "border-success bg-success"
                    : "border-active-work bg-active-work"
                  : isCurrent
                    ? "border-active-work bg-surface ring-2 ring-active-work/45"
                    : "border-border-strong bg-surface"
              }`}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function TaskRow({
  task,
  flow,
  members,
  agents,
  href,
  conversationHref,
  isPending,
  onStart,
  onAccept,
}: {
  task: ProjectTask;
  flow: ProjectFlow | null;
  members: TaskBoardMemberSummary[];
  agents: TaskBoardAgentSummary[];
  href: string;
  conversationHref: string | null;
  isPending: boolean;
  onStart: () => void;
  onAccept: () => void;
}) {
  const owner = members.find((member) => member.userId === task.assigneeUserId);
  const stage =
    flow?.stages.find((candidate) => candidate.id === task.stageId) ??
    (task.status === "done" || task.status === "cancelled" ? null : flow?.stages[0]);
  const agentId = stage?.agentId ?? task.runner?.agentId;
  const agent = agents.find((candidate) => candidate.id === agentId);
  const canRetry = isProjectTaskRetryable(task);
  const needsInput = isProjectTaskAwaitingInput(task);
  const activityAt = task.updatedAt ?? task.createdAt;

  return (
    <article className="group grid gap-4 border-b border-border px-4 py-4 last:border-b-0 hover:bg-surface-elevated/70 lg:grid-cols-[minmax(0,1fr)_190px_130px] lg:items-center">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} />
          {stage ? <span className="text-xs text-muted-foreground">{stage.name}</span> : null}
        </div>
        <Link
          href={href}
          className="block line-clamp-2 text-sm font-semibold text-foreground no-underline hover:!text-active-work hover:!no-underline"
        >
          {task.objective}
        </Link>
        {task.status === "blocked" && task.blockedReason ? (
          <p className="line-clamp-2 text-xs text-attention">
            {task.blockedDetail ?? projectTaskBlockedReasonLabels[task.blockedReason]}
          </p>
        ) : null}
        <PipelineProgress task={task} flow={flow} />
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 text-foreground">
          <Bot size={13} /> {agent?.name ?? "No agent assigned"}
        </p>
        <p>{owner?.name ? `Owned by ${owner.name}` : "No human owner"}</p>
        <p>{formatRelativeTime(activityAt)}</p>
      </div>

      <div className="flex items-center gap-2 lg:justify-end">
        {task.status === "review" ? (
          <Button variant="primary" size="sm" onClick={onAccept} disabled={isPending}>
            Approve
          </Button>
        ) : null}
        {task.status === "backlog" ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Play size={13} />}
            onClick={onStart}
            disabled={isPending}
          >
            Run
          </Button>
        ) : null}
        {canRetry ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<Play size={13} />}
            onClick={onStart}
            disabled={isPending}
          >
            Retry
          </Button>
        ) : null}
        {task.status === "blocked" && !canRetry && conversationHref ? (
          <ButtonLink
            href={conversationHref}
            variant="primary"
            size="sm"
            icon={<MessageSquareText size={13} />}
            className="no-underline hover:!no-underline"
          >
            {needsInput ? "Answer questions" : "Respond"}
          </ButtonLink>
        ) : null}
        {task.status === "blocked" && !canRetry && !conversationHref ? (
          <ButtonLink
            href={href}
            variant="outline"
            size="sm"
            icon={<ArrowRight size={13} />}
            className="no-underline hover:!no-underline"
          >
            Review
          </ButtonLink>
        ) : null}
        {task.status === "done" && conversationHref ? (
          <ButtonLink
            href={conversationHref}
            variant="outline"
            size="sm"
            icon={<MessageSquareText size={13} />}
            className="no-underline hover:!no-underline"
          >
            View result
          </ButtonLink>
        ) : null}
      </div>
    </article>
  );
}

function FlowStrip({
  flow,
  agents,
  canManage,
  onConfigure,
}: {
  flow: ProjectFlow | null;
  agents: TaskBoardAgentSummary[];
  canManage: boolean;
  onConfigure: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-elevated/60 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch size={15} /> Agent pipeline
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Each completed stage either hands work to the next agent or stops for review.
          </p>
        </div>
        {canManage ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<Settings2 size={14} />}
            onClick={onConfigure}
          >
            Configure
          </Button>
        ) : null}
      </div>

      {flow ? (
        <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {flow.stages.map((stage, index) => {
            const agent = agents.find((candidate) => candidate.id === stage.agentId);

            return (
              <li
                key={stage.id}
                className="relative rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-[11px] font-semibold">
                    {index + 1}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    {stage.advance === "on_goal_complete" ? (
                      <Sparkles size={11} />
                    ) : (
                      <Pause size={11} />
                    )}
                    {stage.advance === "on_goal_complete" ? "Auto hand-off" : "Human review"}
                  </span>
                </div>
                <p className="mt-3 truncate text-sm font-semibold">{stage.name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {agent?.name ?? "Project default agent"}
                  {stage.mode ? ` · ${stage.mode}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border-strong px-4 py-5">
          <div>
            <p className="text-sm font-medium">No agent pipeline configured</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add stages to hand work between specialist agents automatically.
            </p>
          </div>
          {canManage ? (
            <Button variant="primary" size="sm" onClick={onConfigure}>
              Build pipeline
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function TaskBoard({
  tasks,
  flow,
  members,
  agents,
  pendingTaskIds = NO_PENDING_TASKS,
  taskHref,
  conversationHref,
  onStartTask,
  onAcceptTask,
  onCreateTask,
  onConfigureFlow,
  canCreateTask,
  canManageFlow,
}: TaskBoardProps) {
  const [filters, setFilters] = useState<TaskQueueFilters>(DEFAULT_TASK_QUEUE_FILTERS);
  const sortedTasks = sortCopy(
    tasks,
    (left, right) =>
      STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
      new Date(right.updatedAt ?? right.createdAt).getTime() -
        new Date(left.updatedAt ?? left.createdAt).getTime(),
  );
  const running = tasks.filter((task) => task.status === "running" || task.status === "queued");
  const attention = tasks.filter((task) => task.status === "blocked" || task.status === "review");
  const completed = tasks.filter((task) => task.status === "done");
  const filteredTasks = filterTaskQueue(sortedTasks, filters);

  return (
    <div className="space-y-5">
      <FlowStrip
        flow={flow}
        agents={agents}
        canManage={canManageFlow}
        onConfigure={onConfigureFlow}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-active-work/45 bg-active-work/12 p-4">
          <p className="text-2xl font-semibold text-active-work">{running.length}</p>
          <p className="mt-1 text-xs text-active-work">Agents active or queued</p>
        </div>
        <div className="rounded-xl border border-attention/45 bg-attention/12 p-4">
          <p className="text-2xl font-semibold text-attention">{attention.length}</p>
          <p className="mt-1 text-xs text-attention">Waiting for attention</p>
        </div>
        <div className="rounded-xl border border-success/45 bg-success/12 p-4">
          <p className="text-2xl font-semibold text-success">{completed.length}</p>
          <p className="mt-1 text-xs text-success">Completed and accepted</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Work queue</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live work ordered by what needs attention first.
            </p>
          </div>
          {canCreateTask ? (
            <Button variant="primary" size="sm" onClick={onCreateTask}>
              Add work
            </Button>
          ) : null}
        </header>

        {tasks.length ? (
          <TaskBoardFilters
            filters={filters}
            flow={flow}
            matchCount={filteredTasks.length}
            totalCount={tasks.length}
            onChange={setFilters}
            onClear={() => setFilters(DEFAULT_TASK_QUEUE_FILTERS)}
          />
        ) : null}

        {filteredTasks.length ? (
          <div>
            {filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                flow={flow}
                members={members}
                agents={agents}
                href={taskHref(task)}
                conversationHref={conversationHref(task)}
                isPending={pendingTaskIds.includes(task.id)}
                onStart={() => onStartTask(task)}
                onAccept={() => onAcceptTask(task)}
              />
            ))}
          </div>
        ) : tasks.length ? (
          <EmptyState
            icon={<SlidersHorizontal className="text-muted-foreground" size={24} />}
            title="No work matches"
            message="Adjust the queue filters to see more work."
            action={
              <Button variant="secondary" onClick={() => setFilters(DEFAULT_TASK_QUEUE_FILTERS)}>
                Clear filters
              </Button>
            }
            className="min-h-[240px]"
          />
        ) : (
          <EmptyState
            icon={<ListChecks className="text-muted-foreground" size={24} />}
            title="The queue is empty"
            message="Add an outcome, then let the configured agents move it through the pipeline."
            action={
              canCreateTask ? (
                <Button variant="primary" onClick={onCreateTask}>
                  Add work
                </Button>
              ) : undefined
            }
            className="min-h-[240px]"
          />
        )}
      </section>
    </div>
  );
}
