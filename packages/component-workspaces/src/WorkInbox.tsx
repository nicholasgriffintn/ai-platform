import { Badge, Button, cn, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import type {
  ProjectTaskAttentionItem,
  ProjectTaskAttentionKind,
  WorkInboxItem,
} from "@ngriffin_uk/polychat-schemas";
import { formatClockTime, formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { Check, Eye, Inbox, X } from "lucide-react";

type Tone = "info" | "warning" | "failure" | "success";

const DECISION_LABELS: Record<WorkInboxItem["kind"], { label: string; tone: Tone }> = {
  hire: { label: "Hire", tone: "info" },
  budget: { label: "Budget", tone: "warning" },
  standup: { label: "Standup", tone: "info" },
  escalation: { label: "Escalated", tone: "failure" },
  setup: { label: "Setup plan", tone: "info" },
  paused: { label: "Paused", tone: "failure" },
  waiting: { label: "Waiting", tone: "info" },
  breakdown: { label: "Breakdown", tone: "info" },
};

const TASK_LABELS: Record<ProjectTaskAttentionKind, { label: string; tone: Tone }> = {
  input: { label: "Questions", tone: "info" },
  approval: { label: "Approval", tone: "info" },
  review: { label: "Review", tone: "info" },
  blocked: { label: "Stuck", tone: "failure" },
  assigned: { label: "Yours", tone: "info" },
  completion: { label: "Done", tone: "success" },
};

type InboxEntry =
  | { type: "decision"; since: string; item: WorkInboxItem }
  | { type: "task"; since: string; item: ProjectTaskAttentionItem };

function entriesOf(
  decisions: readonly WorkInboxItem[],
  tasks: readonly ProjectTaskAttentionItem[],
): InboxEntry[] {
  const entries: InboxEntry[] = [
    ...decisions.map((item) => ({ type: "decision" as const, since: item.since, item })),
    ...tasks.map((item) => ({ type: "task" as const, since: item.since, item })),
  ];
  const needsAction = (entry: InboxEntry) =>
    entry.type === "decision" || entry.item.requiresAction ? 0 : 1;

  return entries.sort(
    (left, right) =>
      needsAction(left) - needsAction(right) || right.since.localeCompare(left.since),
  );
}

function InboxRow({
  label,
  tone,
  title,
  context,
  detail,
  since,
  href,
  unread,
  onOpen,
  actions,
}: {
  label: string;
  tone: Tone;
  title: string;
  context: string | null;
  detail: string | null;
  since: string;
  href: string;
  unread: boolean;
  onOpen?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge variant={tone} className="mt-0.5 w-20">
        {label}
      </Badge>
      <Link
        href={href}
        aria-label={title}
        className="group min-w-0 flex-1 no-underline hover:!no-underline"
        onClick={onOpen}
      >
        <span className="flex items-center gap-2">
          {unread ? (
            <span className="size-1.5 shrink-0 rounded-full bg-active-work" aria-label="Unread" />
          ) : null}
          <span
            className={cn(
              "line-clamp-1 text-sm text-foreground group-hover:underline",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {title}
          </span>
        </span>
        {detail ? (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{detail}</span>
        ) : null}
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {[context, formatRelativeTime(since)].filter(Boolean).join(" · ")}
        </span>
      </Link>
      {actions ? <span className="flex shrink-0 items-center gap-1">{actions}</span> : null}
    </li>
  );
}

export function WorkInbox({
  decisions,
  tasks,
  isLoading,
  errorMessage,
  canDecideHire,
  isBusy,
  onDecideHire,
  onRead,
  onDismiss,
}: {
  decisions: readonly WorkInboxItem[];
  tasks: readonly ProjectTaskAttentionItem[];
  isLoading: boolean;
  errorMessage?: string;
  canDecideHire: (workspaceId: string) => boolean;
  isBusy: boolean;
  onDecideHire: (item: WorkInboxItem, decision: "approve" | "reject") => void;
  onRead: (item: ProjectTaskAttentionItem) => void;
  onDismiss: (item: ProjectTaskAttentionItem) => void;
}) {
  const entries = entriesOf(decisions, tasks);

  if (errorMessage && entries.length === 0) {
    return (
      <p role="alert" className="text-sm text-failure">
        {errorMessage}
      </p>
    );
  }

  if (isLoading && entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading your inbox…</p>;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="text-muted-foreground" size={24} />}
        title="Nothing needs you"
        message="Leads handle their team's questions and failures first. Approvals, hires, escalations and anything only you can answer land here."
        className="min-h-[240px]"
      />
    );
  }

  return (
    <div className="space-y-2">
      {errorMessage ? (
        <p role="alert" className="text-sm text-failure">
          {errorMessage}
        </p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {entries.map((entry) => {
          if (entry.type === "decision") {
            const { item } = entry;
            const { label, tone } = DECISION_LABELS[item.kind];

            return (
              <InboxRow
                key={item.id}
                label={label}
                tone={tone}
                title={item.title}
                context={item.dueAt ? `Closes ${formatClockTime(item.dueAt)}` : null}
                detail={item.detail}
                since={item.since}
                href={item.deepLink}
                unread
                actions={
                  item.kind === "hire" && item.teammateId && canDecideHire(item.workspaceId) ? (
                    <>
                      <Button
                        size="xs"
                        variant="primary"
                        disabled={isBusy}
                        onClick={() => onDecideHire(item, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => onDecideHire(item, "reject")}
                      >
                        Reject
                      </Button>
                    </>
                  ) : undefined
                }
              />
            );
          }

          const { item } = entry;
          const { label, tone } = TASK_LABELS[item.kind];

          return (
            <InboxRow
              key={item.id}
              label={label}
              tone={tone}
              title={item.objective}
              context={item.projectName}
              detail={item.detail}
              since={item.since}
              href={item.deepLink}
              unread={!item.isRead}
              onOpen={() => onRead(item)}
              actions={
                <>
                  {!item.isRead ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Mark ${item.objective} read`}
                      title="Mark read"
                      onClick={() => onRead(item)}
                    >
                      {item.requiresAction ? <Eye size={15} /> : <Check size={15} />}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Dismiss ${item.objective}`}
                    title="Dismiss"
                    onClick={() => onDismiss(item)}
                  >
                    <X size={15} />
                  </Button>
                </>
              }
            />
          );
        })}
      </ul>
    </div>
  );
}
