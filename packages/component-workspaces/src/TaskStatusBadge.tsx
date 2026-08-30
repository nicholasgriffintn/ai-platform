import { Badge } from "@ngriffin_uk/polychat-component-ui";
import { projectTaskStatusLabels, type ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle, Check, CheckCircle2, Circle, Clock3, Loader2 } from "lucide-react";

const STATUS_VARIANT = {
  backlog: "outline",
  queued: "info",
  running: "info",
  blocked: "warning",
  review: "success",
  done: "success",
  cancelled: "secondary",
} as const;

function StatusIcon({ status }: { status: ProjectTaskStatus }) {
  if (status === "running") {
    return <Loader2 className="animate-spin" />;
  }

  if (status === "blocked") {
    return <AlertTriangle />;
  }

  if (status === "review") {
    return <CheckCircle2 />;
  }

  if (status === "done") {
    return <Check />;
  }

  if (status === "queued") {
    return <Clock3 />;
  }

  return <Circle />;
}

export function TaskStatusBadge({ status }: { status: ProjectTaskStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <StatusIcon status={status} />
      {projectTaskStatusLabels[status]}
    </Badge>
  );
}
