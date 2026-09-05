import { Badge, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  formatRunActivityDuration,
  formatRunActivityUsage,
  type RunActivityEntry,
  type RunActivityKind,
} from "@ngriffin_uk/polychat-library-chat/run-activity";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import {
  Activity,
  AlertTriangle,
  Bot,
  CircleDot,
  ClipboardCheck,
  FileTerminal,
  GitPullRequestArrow,
  MessageSquare,
  Server,
  ShieldQuestion,
  UserRound,
  Wrench,
} from "lucide-react";

export interface RunActivityPanelProps {
  entries: readonly RunActivityEntry[];
  isLoading?: boolean;
  errorMessage?: string;
}

const STATUS_LABELS: Record<NonNullable<RunActivityEntry["status"]>, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  failed: "Failed",
  pending: "Pending",
  running: "Running",
  waiting: "Waiting",
};

function ActivityIcon({ kind }: { kind: RunActivityKind }) {
  const Icon = {
    approval: ShieldQuestion,
    command: FileTerminal,
    conversation: MessageSquare,
    error: AlertTriangle,
    instruction: UserRound,
    lifecycle: CircleDot,
    model: Bot,
    plan: GitPullRequestArrow,
    service: Server,
    tool: Wrench,
    validation: ClipboardCheck,
  }[kind];

  return <Icon className="size-4" aria-hidden="true" />;
}

function statusClass(status: RunActivityEntry["status"]): string {
  if (status === "failed") {
    return "border-failure/40 text-failure";
  }

  if (status === "completed") {
    return "border-success/40 text-success";
  }

  if (status === "waiting") {
    return "border-attention/40 text-attention";
  }

  if (status === "running") {
    return "border-active-work/40 text-active-work";
  }

  return "text-muted-foreground";
}

function EntryDetails({ entry }: { entry: RunActivityEntry }) {
  const duration = formatRunActivityDuration(entry.durationMs);
  const latency = formatRunActivityDuration(entry.metrics?.latencyMs);
  const usage = formatRunActivityUsage(entry.metrics);
  const hasMetrics = Boolean(latency || usage || entry.metrics?.model || entry.metrics?.provider);

  return (
    <div className="mt-1 space-y-1.5">
      {entry.detail ? (
        <details className="group">
          <summary className="text-muted-foreground focus-visible:ring-ring w-fit cursor-pointer text-xs outline-none focus-visible:ring-2">
            View details
          </summary>
          <p className="bg-surface-elevated mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-md p-2 text-xs leading-5 break-words">
            {entry.detail}
          </p>
        </details>
      ) : null}

      {entry.evidence ? (
        <details className="group">
          <summary className="text-muted-foreground focus-visible:ring-ring w-fit cursor-pointer text-xs outline-none focus-visible:ring-2">
            {entry.evidence.lines.length.toLocaleString()} output updates
            {entry.evidence.omitted > 0 ? ` · ${entry.evidence.omitted} omitted` : ""}
          </summary>
          <pre className="bg-surface-elevated mt-1 max-h-56 overflow-auto rounded-md p-2 text-xs leading-5 whitespace-pre-wrap break-words">
            {entry.evidence.lines.join("\n")}
          </pre>
        </details>
      ) : null}

      {hasMetrics ? (
        <details>
          <summary className="text-muted-foreground focus-visible:ring-ring w-fit cursor-pointer text-xs outline-none focus-visible:ring-2">
            Cost and latency
          </summary>
          <dl className="bg-surface-elevated mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md p-2 text-xs">
            {entry.metrics?.provider ? (
              <>
                <dt className="text-muted-foreground">Provider</dt>
                <dd>{entry.metrics.provider}</dd>
              </>
            ) : null}
            {entry.metrics?.model ? (
              <>
                <dt className="text-muted-foreground">Model</dt>
                <dd>{entry.metrics.model}</dd>
              </>
            ) : null}
            {usage ? (
              <>
                <dt className="text-muted-foreground">Usage</dt>
                <dd>{usage}</dd>
              </>
            ) : null}
            {latency ? (
              <>
                <dt className="text-muted-foreground">Latency</dt>
                <dd>{latency}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}

      {duration ? <p className="text-muted-foreground text-xs">Duration {duration}</p> : null}
    </div>
  );
}

export function RunActivityPanel({
  entries,
  isLoading = false,
  errorMessage,
}: RunActivityPanelProps) {
  if (errorMessage) {
    return (
      <EmptyState
        icon={<AlertTriangle className="text-failure size-5" />}
        title="Activity unavailable"
        message={errorMessage}
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (isLoading) {
    return (
      <EmptyState
        icon={<Activity className="text-muted-foreground size-5" />}
        title="Loading activity"
        message="Restoring the recorded conversation and run history…"
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="text-muted-foreground size-5" />}
        title="No recorded activity yet"
        message="Conversation and run events will appear here as work progresses."
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  return (
    <ol aria-label="Conversation and run activity" className="space-y-1">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="border-border grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b py-3 last:border-0"
        >
          <span className="bg-surface-elevated text-muted-foreground mt-0.5 flex size-7 items-center justify-center rounded-md">
            <ActivityIcon kind={entry.kind} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 text-sm font-medium break-words">{entry.title}</p>
              {entry.status ? (
                <Badge variant="outline" className={statusClass(entry.status)}>
                  {STATUS_LABELS[entry.status]}
                </Badge>
              ) : null}
              {entry.approvalState ? (
                <span className="text-muted-foreground text-xs capitalize">
                  Approval {entry.approvalState.replaceAll("_", " ")}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {entry.source === "conversation" ? "Conversation" : "Coding run"}
              {entry.occurredAt ? ` · ${formatDate(entry.occurredAt)}` : ""}
            </p>
            <EntryDetails entry={entry} />
          </div>
        </li>
      ))}
    </ol>
  );
}
