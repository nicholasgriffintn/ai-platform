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
  Sparkles,
} from "lucide-react";

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

  const currentStageId = task.stageId ?? flow.stages[0]?.id;
  const currentIndex = flow.stages.findIndex((stage) => stage.id === currentStageId);

  return (
    <div className="flex min-w-0 items-center gap-1" aria-label="Pipeline progress">
      {flow.stages.map((stage, index) => {
        const isComplete = task.status === "done" || (currentIndex >= 0 && index < currentIndex);
        const isCurrent = index === currentIndex && task.status !== "done";

        return (
          <div key={stage.id} className="flex min-w-0 flex-1 items-center gap-1 first:pl-0">
            {index > 0 ? (
              <span
                className={`h-px min-w-1 flex-1 ${isComplete || isCurrent ? "bg-blue-400" : "bg-zinc-200 dark:bg-zinc-800"}`}
              />
            ) : null}
            <span
              title={stage.name}
              className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                isComplete
                  ? "border-blue-500 bg-blue-500"
                  : isCurrent
                    ? "border-blue-500 bg-white ring-2 ring-blue-100 dark:bg-zinc-900 dark:ring-blue-950"
                    : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            />
          </div>
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
    <article className="group grid gap-4 border-b border-zinc-100 px-4 py-4 last:border-b-0 hover:bg-zinc-50/70 dark:border-zinc-800/80 dark:hover:bg-white/[0.025] lg:grid-cols-[minmax(0,1fr)_190px_130px] lg:items-center">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} />
          {stage ? <span className="text-xs text-zinc-500">{stage.name}</span> : null}
        </div>
        <Link
          href={href}
          className="block line-clamp-2 text-sm font-semibold text-zinc-950 no-underline hover:!text-blue-700 hover:!no-underline dark:text-zinc-100 dark:hover:!text-blue-300"
        >
          {task.objective}
        </Link>
        {task.status === "blocked" && task.blockedReason ? (
          <p className="line-clamp-2 text-xs text-amber-700 dark:text-amber-300">
            {task.blockedDetail ?? projectTaskBlockedReasonLabels[task.blockedReason]}
          </p>
        ) : null}
        <PipelineProgress task={task} flow={flow} />
      </div>

      <div className="space-y-1 text-xs text-zinc-500">
        <p className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <Bot size={13} /> {agent?.name ?? "No agent assigned"}
        </p>
        <p>{owner?.name ? `Owned by ${owner.name}` : "No human owner"}</p>
        <p>{formatRelativeTime(activityAt)}</p>
      </div>

      <div className="flex items-center gap-2 lg:justify-end">
        {task.status === "review" ? (
          <Button variant="primary" size="sm" onClick={onAccept} disabled={isPending}>
            Accept
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
        {needsInput && conversationHref ? (
          <ButtonLink
            href={conversationHref}
            variant="primary"
            size="sm"
            icon={<MessageSquareText size={13} />}
            className="no-underline hover:!no-underline"
          >
            Answer questions
          </ButtonLink>
        ) : null}
        {task.status === "blocked" && !canRetry && (!needsInput || !conversationHref) ? (
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
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/35">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch size={15} /> Agent pipeline
          </p>
          <p className="mt-1 text-xs text-zinc-500">
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
                className="relative rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700/70 dark:bg-white/[0.035]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-950">
                    {index + 1}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                    {stage.advance === "on_goal_complete" ? (
                      <Sparkles size={11} />
                    ) : (
                      <Pause size={11} />
                    )}
                    {stage.advance === "on_goal_complete" ? "Auto hand-off" : "Human review"}
                  </span>
                </div>
                <p className="mt-3 truncate text-sm font-semibold">{stage.name}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {agent?.name ?? "Project default agent"}
                  {stage.mode ? ` · ${stage.mode}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-5 dark:border-zinc-700">
          <div>
            <p className="text-sm font-medium">No agent pipeline configured</p>
            <p className="mt-1 text-xs text-zinc-500">
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

  return (
    <div className="space-y-5">
      <FlowStrip
        flow={flow}
        agents={agents}
        canManage={canManageFlow}
        onConfigure={onConfigureFlow}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-2xl font-semibold text-blue-950 dark:text-blue-100">
            {running.length}
          </p>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">Agents active or queued</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-2xl font-semibold text-amber-950 dark:text-amber-100">
            {attention.length}
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Waiting for attention</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-2xl font-semibold text-emerald-950 dark:text-emerald-100">
            {completed.length}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Completed and accepted
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800/80">
          <div>
            <h2 className="text-sm font-semibold">Work queue</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Live work ordered by what needs attention first.
            </p>
          </div>
          {canCreateTask ? (
            <Button variant="primary" size="sm" onClick={onCreateTask}>
              Add work
            </Button>
          ) : null}
        </header>

        {sortedTasks.length ? (
          <div>
            {sortedTasks.map((task) => (
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
        ) : (
          <EmptyState
            icon={<ListChecks className="text-zinc-400" size={24} />}
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
