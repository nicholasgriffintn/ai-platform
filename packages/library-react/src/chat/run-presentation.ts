import type { ChatRun } from "@ngriffin_uk/polychat-schemas";

export interface ChatRunPresentation {
  label: string;
  detail: string;
  tone: "active" | "attention" | "danger" | "neutral" | "success";
}

export function getChatRunLoadingMessage(status: ChatRun["status"]): string {
  switch (status) {
    case "accepted":
      return "Task accepted...";
    case "awaiting_approval":
      return "Waiting for approval...";
    case "awaiting_input":
      return "Waiting for your answer...";
    case "cancelling":
      return "Stopping task...";
    case "running":
      return "Task running...";
    case "succeeded":
      return "Task completed.";
    case "failed":
      return "Task failed.";
    case "cancelled":
      return "Task cancelled.";
    case "interrupted":
      return "Task interrupted.";
    default:
      return "Task status unavailable.";
  }
}

export function getChatRunPresentation(run: ChatRun): ChatRunPresentation {
  if (run.status === "running" && run.retry) {
    return {
      label: run.retry.phase === "waiting" ? "Retry scheduled" : "Retrying model",
      detail: `Attempt ${run.retry.attempt} of ${run.retry.maxAttempts} · run retry ${run.retry.runRetry} of ${run.retry.maxRunRetries} · ${run.retry.reason}`,
      tone: "attention",
    };
  }

  switch (run.status) {
    case "accepted":
      return { label: "Task accepted", detail: "Waiting for execution to start.", tone: "active" };
    case "running":
      return { label: "Task running", detail: "Work is continuing.", tone: "active" };
    case "awaiting_input":
      return {
        label: "Answer needed",
        detail: "The task is waiting for your answer.",
        tone: "attention",
      };
    case "awaiting_approval":
      return {
        label: "Approval needed",
        detail: "The task is waiting for approval.",
        tone: "attention",
      };
    case "cancelling":
      return {
        label: "Stop requested",
        detail: "The task owner has not stopped yet.",
        tone: "attention",
      };
    case "succeeded":
      return { label: "Task completed", detail: "The final result is available.", tone: "success" };
    case "failed":
      return {
        label: "Task failed",
        detail: run.terminalReason ?? "The task could not finish.",
        tone: "danger",
      };
    case "cancelled":
      return {
        label: "Task cancelled",
        detail: "Execution stopped after the request was accepted.",
        tone: "neutral",
      };
    case "interrupted":
      return {
        label: "Task interrupted",
        detail: run.terminalReason ?? "Execution ownership was lost.",
        tone: "danger",
      };
    default:
      return { label: "Task status unavailable", detail: "Refresh to try again.", tone: "neutral" };
  }
}
