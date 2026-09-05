import { Badge, EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import type {
  ProjectTaskAttentionItem,
  ProjectTaskAttentionKind,
} from "@ngriffin_uk/polychat-schemas";
import {
  AlertTriangle,
  CheckCircle2,
  CircleQuestionMark,
  Inbox,
  ShieldQuestion,
  UserCheck,
} from "lucide-react";

const KIND_LABELS: Record<ProjectTaskAttentionKind, string> = {
  input: "Questions",
  approval: "Approval",
  review: "Review",
  blocked: "Blocked",
  assigned: "Assigned to you",
};

function kindIcon(kind: ProjectTaskAttentionKind) {
  if (kind === "input") {
    return <CircleQuestionMark className="text-attention" size={16} />;
  }

  if (kind === "approval") {
    return <ShieldQuestion className="text-attention" size={16} />;
  }

  if (kind === "review") {
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
}

export function TaskAttentionList({ items, itemHref, emptyMessage }: TaskAttentionListProps) {
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
        <li key={`${item.kind}-${item.taskId}`}>
          <Link
            href={itemHref(item)}
            aria-label={item.objective}
            className="group block no-underline hover:!no-underline"
          >
            <div className="border-border bg-surface group-hover:border-border-strong flex items-start gap-3 rounded-lg border p-3">
              <span className="mt-0.5">{kindIcon(item.kind)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {KIND_LABELS[item.kind]}
                  </Badge>
                  <span className="text-muted-foreground truncate text-xs">{item.projectName}</span>
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
        </li>
      ))}
    </ul>
  );
}
