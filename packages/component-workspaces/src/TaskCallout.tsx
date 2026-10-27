import { Button, ButtonLink, cn } from "@ngriffin_uk/polychat-component-ui";
import { projectTaskBlockedReasonLabels, type ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle, Check, MessageSquareText, Play, Sparkles } from "lucide-react";

export interface TaskCalloutProps {
  task: ProjectTask;
  needsInput: boolean;
  canRetry: boolean;
  conversationHref: string | null;
  isBusy: boolean;
  onAccept: () => void;
  onRun: () => void;
}

type Tone = "attention" | "failure" | "active";

const TONE_CLASSES: Record<Tone, string> = {
  attention: "border-attention/40 bg-attention/10",
  failure: "border-failure/35 bg-failure/8",
  active: "border-active-work/30 bg-active-work/8",
};

const ICON_CLASSES: Record<Tone, string> = {
  attention: "text-attention",
  failure: "text-failure",
  active: "text-active-work",
};

export function TaskCallout({
  task,
  needsInput,
  canRetry,
  conversationHref,
  isBusy,
  onAccept,
  onRun,
}: TaskCalloutProps) {
  const callout = describeCallout(task, needsInput, canRetry);

  if (!callout) {
    return null;
  }

  const action =
    callout.action === "answer" && conversationHref ? (
      <ButtonLink
        href={conversationHref}
        size="sm"
        variant="primary"
        icon={<MessageSquareText size={14} />}
        className="no-underline hover:!no-underline"
      >
        {task.blockedReason === "awaiting_approval" ? "Review request" : "Answer questions"}
      </ButtonLink>
    ) : callout.action === "approve" ? (
      <Button
        size="sm"
        variant="primary"
        icon={<Check size={14} />}
        disabled={isBusy}
        onClick={onAccept}
      >
        Approve result
      </Button>
    ) : callout.action === "run" || callout.action === "retry" ? (
      <Button
        size="sm"
        variant={callout.action === "run" ? "primary" : "secondary"}
        icon={<Play size={14} />}
        disabled={isBusy}
        onClick={onRun}
      >
        {callout.action === "run" ? "Run" : "Run again"}
      </Button>
    ) : null;

  return (
    <div
      role={callout.tone === "active" ? undefined : "status"}
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3",
        TONE_CLASSES[callout.tone],
      )}
    >
      {callout.tone === "active" ? (
        <Sparkles size={16} className={cn("mt-0.5 shrink-0", ICON_CLASSES[callout.tone])} />
      ) : (
        <AlertTriangle size={16} className={cn("mt-0.5 shrink-0", ICON_CLASSES[callout.tone])} />
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">{callout.title}</p>
        {callout.detail ? <p className="mt-0.5 text-muted-foreground">{callout.detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

function describeCallout(
  task: ProjectTask,
  needsInput: boolean,
  canRetry: boolean,
): {
  tone: Tone;
  title: string;
  detail: string | null;
  action: "answer" | "approve" | "run" | "retry" | null;
} | null {
  if (needsInput) {
    return {
      tone: "attention",
      title: task.blockedReason
        ? projectTaskBlockedReasonLabels[task.blockedReason]
        : "Waiting for you",
      detail: task.blockedDetail,
      action: "answer",
    };
  }

  if (task.status === "review") {
    return {
      tone: "attention",
      title: "Ready for your review",
      detail: "Check the result below, then approve it or reply with what to change.",
      action: "approve",
    };
  }

  if (task.status === "blocked") {
    return {
      tone: "failure",
      title: task.blockedReason ? projectTaskBlockedReasonLabels[task.blockedReason] : "Stuck",
      detail: task.blockedDetail,
      action: canRetry ? "retry" : null,
    };
  }

  if (task.status === "backlog" && task.kind === "task") {
    return {
      tone: "active",
      title: "Not started",
      detail: task.owner
        ? "Run it now, or leave it for its owner to pick up."
        : "Assign it or run it now.",
      action: "run",
    };
  }

  return null;
}
