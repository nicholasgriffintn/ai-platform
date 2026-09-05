import { Badge, Button, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import type {
  ProjectTaskAttentionItem,
  ProjectTaskAttentionKind,
} from "@ngriffin_uk/polychat-schemas";
import {
  AlertTriangle,
  CheckCircle2,
  CircleQuestionMark,
  Inbox,
  Eye,
  X,
  ShieldQuestion,
  UserCheck,
} from "lucide-react";

const KIND_LABELS: Record<ProjectTaskAttentionKind, string> = {
  input: "Questions",
  approval: "Approval",
  review: "Review",
  blocked: "Blocked",
  assigned: "Assigned to you",
  completion: "Completed",
};

function kindIcon(kind: ProjectTaskAttentionKind) {
  if (kind === "input") {
    return <CircleQuestionMark className="text-amber-500" size={16} />;
  }

  if (kind === "approval") {
    return <ShieldQuestion className="text-amber-500" size={16} />;
  }

  if (kind === "review") {
    return <CheckCircle2 className="text-emerald-500" size={16} />;
  }

  if (kind === "blocked") {
    return <AlertTriangle className="text-amber-500" size={16} />;
  }

  if (kind === "completion") {
    return <CheckCircle2 className="text-emerald-500" size={16} />;
  }

  return <UserCheck className="text-blue-500" size={16} />;
}

export interface TaskAttentionListProps {
  items: ProjectTaskAttentionItem[];
  itemHref: (item: ProjectTaskAttentionItem) => string;
  emptyMessage?: string;
  onRead?: (item: ProjectTaskAttentionItem) => void;
  onDismiss?: (item: ProjectTaskAttentionItem) => void;
}

export function TaskAttentionList({
  items,
  itemHref,
  emptyMessage,
  onRead,
  onDismiss,
}: TaskAttentionListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="text-zinc-400" size={24} />}
        title="Nothing waiting on you"
        message={emptyMessage ?? "When a task needs an approval or a decision, it lands here."}
        className="min-h-[200px]"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Link
            href={itemHref(item)}
            aria-label={item.objective}
            className="group min-w-0 flex-1 no-underline hover:!no-underline"
            onClick={() => onRead?.(item)}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5">{kindIcon(item.kind)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {KIND_LABELS[item.kind]}
                  </Badge>
                  <span className="truncate text-xs text-zinc-500">{item.projectName}</span>
                  {!item.isRead && <span className="size-2 rounded-full bg-blue-500" />}
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-zinc-950 group-hover:underline dark:text-white">
                  {item.objective}
                </p>
                {item.detail && (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{item.detail}</p>
                )}
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 gap-1">
            {!item.isRead && onRead && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Mark ${item.objective} read`}
                onClick={() => onRead(item)}
              >
                <Eye size={15} />
              </Button>
            )}
            {onDismiss && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Dismiss ${item.objective}`}
                onClick={() => onDismiss(item)}
              >
                <X size={15} />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
