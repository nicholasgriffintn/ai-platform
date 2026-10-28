import { PageStatus, SegmentedControl } from "@ngriffin_uk/polychat-component-ui";
import { useAdminTasks, useAuthStatus } from "@ngriffin_uk/polychat-library-react";
import type { AdminTask, AdminTaskView } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { ProfileTab, ProfileTabSection } from "../ProfileTabLayout.js";

const VIEW_OPTIONS = [
  { id: "active", label: "Running and waiting" },
  { id: "failed", label: "Failed" },
  { id: "all", label: "Everything recent" },
] as const satisfies readonly { id: AdminTaskView; label: string }[];

function describeProgress(task: AdminTask): string {
  if (task.status === "running" && task.lease_expires_at) {
    return Date.parse(task.lease_expires_at) < Date.now()
      ? "Stalled: its lease ran out"
      : `Running since ${formatRelativeTime(task.last_attempted_at ?? task.updated_at ?? task.created_at)}`;
  }

  if (task.scheduled_at && Date.parse(task.scheduled_at) > Date.now()) {
    return `Due ${new Date(task.scheduled_at).toLocaleString()}`;
  }

  return `Updated ${formatRelativeTime(task.updated_at ?? task.created_at)}`;
}

export function ProfileBackgroundTasksTab() {
  const { user } = useAuthStatus();
  const [view, setView] = useState<AdminTaskView>("active");
  const isAdmin = user?.role === "admin";
  const { data, isLoading, error } = useAdminTasks(view, isAdmin);

  if (!isAdmin) {
    return <PageStatus message="Background tasks are only visible to administrators." />;
  }

  return (
    <ProfileTab
      title="Background tasks"
      description="Every account's queued, running and failed work, refreshed every ten seconds."
    >
      <ProfileTabSection title="Backlog">
        {data && data.counts.length > 0 ? (
          <ul className="grid gap-1 text-sm">
            {data.counts.map((count) => (
              <li
                key={`${count.task_type}:${count.status}`}
                className="flex justify-between gap-4 border-b border-border/60 py-1"
              >
                <span className="font-mono text-xs">{count.task_type}</span>
                <span className="text-muted-foreground">
                  {count.count} {count.status}, oldest {formatRelativeTime(count.oldest)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing waiting. The queue is clear.</p>
        )}
      </ProfileTabSection>
      <ProfileTabSection title="Tasks">
        <SegmentedControl
          label="Task views"
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
        />
        {isLoading ? (
          <PageStatus message="Reading the queue..." />
        ) : error ? (
          <PageStatus message={error.message} />
        ) : (
          <ul className="mt-3 grid gap-2">
            {(data?.tasks ?? []).map((task) => (
              <li key={task.id} className="rounded-md border border-border/60 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-xs">{task.task_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {task.status} · {describeProgress(task)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {task.user_id === null ? "System" : `User ${task.user_id}`} · attempt{" "}
                  {task.attempts}
                  {task.recovery_count > 0 ? ` · recovered ${task.recovery_count}×` : ""} ·{" "}
                  <span className="font-mono">{task.id}</span>
                </div>
                {task.error_message ? (
                  <p className="mt-1 text-xs text-destructive">{task.error_message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ProfileTabSection>
    </ProfileTab>
  );
}
