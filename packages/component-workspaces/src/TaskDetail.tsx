import { Badge, Button, Link } from "@ngriffin_uk/polychat-component-ui";
import type { Goal, ProjectFlow, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import {
  isTerminalProjectTaskStatus,
  projectTaskBlockedReasonLabels,
  projectTaskStatusLabels,
} from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, reverseCopy } from "@ngriffin_uk/polychat-utility-core";
import {
  AlertTriangle,
  Check,
  Circle,
  Loader2,
  MessageSquareText,
  Play,
  Trash2,
} from "lucide-react";

export interface TaskDetailProps {
  task: ProjectTask;
  goal: Goal | null;
  flow: ProjectFlow | null;
  members: { userId: number; name: string | null }[];
  agents: { id: string; name: string }[];
  blockedBy: ProjectTask[];
  conversationHref: string | null;
  taskHref: (task: ProjectTask) => string;
  isBusy?: boolean;
  onRun: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onReopen: () => void;
  onDelete: () => void;
}

const EVIDENCE_TONE: Record<string, string> = {
  confirmed: "text-emerald-700 dark:text-emerald-400",
  approximate: "text-amber-700 dark:text-amber-400",
  supporting: "text-zinc-600 dark:text-zinc-400",
  blocked: "text-rose-700 dark:text-rose-400",
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
  flow,
  members,
  agents,
  blockedBy,
  conversationHref,
  taskHref,
  isBusy = false,
  onRun,
  onAccept,
  onCancel,
  onReopen,
  onDelete,
}: TaskDetailProps) {
  const owner = members.find((member) => member.userId === task.assigneeUserId);
  const stage = flow?.stages.find((candidate) => candidate.id === task.stageId);
  const agentId = stage?.agentId ?? task.runner?.agentId;
  const agent = agents.find((candidate) => candidate.id === agentId);
  const isFinished = isTerminalProjectTaskStatus(task.status);
  const canRun = !isFinished && task.status !== "running" && task.status !== "queued";
  const progress = reverseCopy(goal?.progress ?? []);
  const evidence = goal?.evidence ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{projectTaskStatusLabels[task.status]}</Badge>
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

        <div className="flex flex-wrap gap-2">
          {task.status === "review" && (
            <Button variant="primary" onClick={onAccept} disabled={isBusy}>
              Accept
            </Button>
          )}
          {canRun && (
            <Button variant="secondary" onClick={onRun} disabled={isBusy}>
              <Play size={14} />
              {task.status === "backlog" ? "Run" : "Run again"}
            </Button>
          )}
          {conversationHref && (
            <Link
              href={conversationHref}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm no-underline hover:!no-underline dark:border-zinc-700"
            >
              <MessageSquareText size={14} /> Open its conversation
            </Link>
          )}
          {isFinished ? (
            <Button variant="secondary" onClick={onReopen} disabled={isBusy}>
              Reopen
            </Button>
          ) : (
            <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
              Cancel
            </Button>
          )}
          <Button
            variant="secondary"
            className="text-red-700 dark:text-red-400"
            onClick={onDelete}
            disabled={isBusy || task.status === "running"}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Done when</h2>
          {task.acceptanceCriteria.length > 0 ? (
            <ul className="space-y-2">
              {task.acceptanceCriteria.map((criterion) => (
                <li key={criterion.id} className="flex items-start gap-2 text-sm">
                  <Circle size={14} className="mt-0.5 shrink-0 text-zinc-400" />
                  <span>{criterion.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              No acceptance criteria, so the goal has nothing to check itself against.
            </p>
          )}
        </section>

        {flow ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Agent pipeline
            </h2>
            <ol className="grid gap-2 sm:grid-cols-2">
              {flow.stages.map((flowStage, index) => {
                const currentIndex = flow.stages.findIndex(
                  (candidate) => candidate.id === task.stageId,
                );
                const completed = task.status === "done" || index < currentIndex;
                const current = flowStage.id === task.stageId && task.status !== "done";
                const flowAgent = agents.find((candidate) => candidate.id === flowStage.agentId);

                return (
                  <li
                    key={flowStage.id}
                    className={`rounded-lg border p-3 ${
                      current
                        ? "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {completed ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : current ? (
                        <Loader2
                          size={14}
                          className={
                            task.status === "running"
                              ? "animate-spin text-blue-500"
                              : "text-blue-500"
                          }
                        />
                      ) : (
                        <Circle size={14} className="text-zinc-400" />
                      )}
                      <p className="text-sm font-medium">{flowStage.name}</p>
                    </div>
                    <p className="mt-1 pl-[22px] text-xs text-zinc-500">
                      {flowAgent?.name ?? "Project default agent"} ·{" "}
                      {flowStage.mode ?? "default mode"}
                    </p>
                    {flowStage.instructions ? (
                      <p className="mt-2 pl-[22px] text-xs text-zinc-600 dark:text-zinc-400">
                        {flowStage.instructions}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

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

          {task.status === "running" && (
            <p className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Loader2 size={14} className="animate-spin" /> Working now…
            </p>
          )}

          {progress.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {task.status === "backlog"
                ? "Nothing yet. Run it and each step will appear here."
                : "No steps recorded yet."}
            </p>
          ) : (
            <ol className="space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
              {progress.map((entry) => (
                <li key={`${entry.iteration}-${entry.at}`} className="relative">
                  <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">{entry.summary}</p>
                  {entry.evidence.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {entry.evidence.map((item) => (
                        <li key={`${entry.iteration}:${item}`} className="text-xs text-zinc-500">
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {entry.next && <p className="mt-1 text-xs text-zinc-500">Next: {entry.next}</p>}
                  {entry.steer && (
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      You steered: {entry.steer}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Step {entry.iteration} · {new Date(entry.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {goal?.stopped_reason && (
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
                    <span
                      className={`shrink-0 text-xs ${EVIDENCE_TONE[entry.status] ?? "text-zinc-500"}`}
                    >
                      {entry.status}
                    </span>
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
                    <Link href={taskHref(dependency)}>{dependency.objective}</Link>
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
