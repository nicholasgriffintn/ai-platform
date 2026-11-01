import {
  Badge,
  Button,
  ButtonLink,
  ConfirmationDialog,
  PageStatus,
} from "@ngriffin_uk/polychat-component-ui";
import { useAdminTask, useAdminTaskAction } from "@ngriffin_uk/polychat-library-react";
import type {
  AdminTaskDetail as AdminTaskDetailData,
  AdminTaskStep,
} from "@ngriffin_uk/polychat-schemas";
import { formatElapsedMs, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { ArrowLeft, RotateCcw, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ADMIN_PATHS } from "../admin-paths.js";
import {
  OPEN_TASK_STATUSES,
  RETRYABLE_TASK_STATUSES,
  STEP_STATUS_TONE,
  TASK_STATUS_TONE,
  WORKFLOW_STATUS_LABEL,
  WORKFLOW_STATUS_TONE,
} from "./task-display.js";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function when(value: string | null): string {
  return value ? `${new Date(value).toLocaleString()} (${formatRelativeTime(value)})` : "–";
}

function StepRow({ step }: { step: AdminTaskStep }) {
  return (
    <li className="rounded-md border border-border/60 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-foreground">{step.step ?? "run"}</span>
          <Badge variant={STEP_STATUS_TONE[step.status]}>{step.status}</Badge>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {step.execution_time_ms === null
            ? `Started ${formatRelativeTime(step.started_at)}`
            : `${formatElapsedMs(step.execution_time_ms)} · ${formatRelativeTime(step.started_at)}`}
        </span>
      </div>
      {step.error_message ? (
        <p className="mt-1 text-xs whitespace-pre-wrap text-failure">{step.error_message}</p>
      ) : null}
    </li>
  );
}

function TaskActions({ detail }: { detail: AdminTaskDetailData }) {
  const action = useAdminTaskAction();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const { task } = detail;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {RETRYABLE_TASK_STATUSES.has(task.status) ? (
          <Button
            variant="primary"
            size="sm"
            icon={<RotateCcw size={14} />}
            disabled={action.isPending}
            onClick={() => action.mutate({ taskId: task.id, action: "retry" })}
          >
            Run it again
          </Button>
        ) : null}
        {OPEN_TASK_STATUSES.has(task.status) ? (
          <Button
            variant="outline"
            size="sm"
            icon={<X size={14} />}
            disabled={action.isPending}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {action.error ? <p className="text-xs text-failure">{action.error.message}</p> : null}
      <ConfirmationDialog
        open={confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title="Cancel this task?"
        description="Its workflow run stops, and any step already in flight finishes without saving its outcome."
        confirmText="Cancel task"
        cancelText="Keep it"
        variant="destructive"
        isLoading={action.isPending}
        onConfirm={async () => {
          await action.mutateAsync({ taskId: task.id, action: "cancel" });
          setConfirmingCancel(false);
        }}
      />
    </div>
  );
}

export function AdminTaskDetail({ taskId }: { taskId: string }) {
  const { data, isLoading, error } = useAdminTask(taskId, true);

  if (isLoading) {
    return <PageStatus message="Fetching the task..." />;
  }

  if (error || !data) {
    return <PageStatus message={error?.message ?? "This task has flown off."} />;
  }

  const { task, workflow, steps } = data;
  const ordered = [...steps].reverse();

  return (
    <div className="space-y-8">
      <ButtonLink href={ADMIN_PATHS.tasks} variant="ghost" size="sm" icon={<ArrowLeft size={14} />}>
        All tasks
      </ButtonLink>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-lg text-foreground">{task.task_type}</h2>
          <Badge variant={TASK_STATUS_TONE[task.status]}>{task.status}</Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{task.id}</p>
        {task.error_message ? (
          <p className="text-sm whitespace-pre-wrap text-failure">{task.error_message}</p>
        ) : null}
        <TaskActions detail={data} />
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Owner">{task.user_id === null ? "System" : `User ${task.user_id}`}</Fact>
        <Fact label="Project">{task.project_id ?? "–"}</Fact>
        <Fact label="Attempts">
          {task.attempts} of {task.max_attempts}
        </Fact>
        <Fact label="Created">{when(task.created_at)}</Fact>
        <Fact label="Last started">{when(task.last_attempted_at)}</Fact>
        <Fact label="Finished">{when(task.completed_at)}</Fact>
        <Fact label="Scheduled for">{when(task.scheduled_at)}</Fact>
        <Fact label="Priority">{task.priority}</Fact>
        <Fact label="Workflow run">
          {workflow ? (
            <span className="space-y-1">
              <span className="flex items-center gap-2">
                <Badge variant={WORKFLOW_STATUS_TONE[workflow.status]}>
                  {WORKFLOW_STATUS_LABEL[workflow.status]}
                </Badge>
              </span>
              <span className="block font-mono text-xs text-muted-foreground">
                {workflow.instance_id}
              </span>
              {workflow.error ? (
                <span className="block text-xs text-failure">{workflow.error}</span>
              ) : null}
            </span>
          ) : (
            "Not started yet"
          )}
        </Fact>
      </dl>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-display text-lg text-foreground">Steps</h3>
          <p className="text-sm text-muted-foreground">
            Every attempt at every step, oldest first. A retried step shows each try.
          </p>
        </div>
        {ordered.length > 0 ? (
          <ol className="grid gap-2">
            {ordered.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No steps have run yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg text-foreground">Payload</h3>
        <details className="rounded-md border border-border/60 p-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">Task data</summary>
          <pre className="mt-2 overflow-x-auto text-xs text-foreground">
            {JSON.stringify(task.task_data, null, 2)}
          </pre>
        </details>
        {task.metadata ? (
          <details className="rounded-md border border-border/60 p-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">Metadata</summary>
            <pre className="mt-2 overflow-x-auto text-xs text-foreground">
              {JSON.stringify(task.metadata, null, 2)}
            </pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}
