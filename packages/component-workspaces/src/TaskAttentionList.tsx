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
    return <CircleQuestionMark className="text-attention" size={16} />;
  }

  if (kind === "approval") {
    return <ShieldQuestion className="text-attention" size={16} />;
  }

  if (kind === "review" || kind === "completion") {
    return <CheckCircle2 className="text-success" size={16} />;
  }

  if (kind === "blocked") {
    return <AlertTriangle className="text-attention" size={16} />;
  }

  return <UserCheck className="text-active-work" size={16} />;
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
        icon={<Inbox className="text-muted-foreground" size={24} />}
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
          className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3"
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
                  <span className="text-muted-foreground truncate text-xs">{item.projectName}</span>
                  {!item.isRead && <span className="size-2 rounded-full bg-active-work" />}
                </div>
                <p className="text-foreground mt-1 line-clamp-2 text-sm font-medium group-hover:underline">
                  {item.objective}
                </p>
                {item.detail && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{item.detail}</p>
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
