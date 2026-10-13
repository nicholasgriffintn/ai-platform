import type { PlatformResponse, ResponseStatus } from "@ngriffin_uk/polychat-schemas";

export interface ResponsePresentation {
  label: string;
  detail: string;
  tone: "active" | "attention" | "danger" | "neutral" | "success";
}

export function getResponseLoadingMessage(status: ResponseStatus): string {
  switch (status) {
    case "queued":
      return "Task accepted...";
    case "awaiting_approval":
      return "Waiting for approval...";
    case "awaiting_input":
      return "Waiting for your answer...";
    case "awaiting_takeover":
      return "Waiting for you to take control...";
    case "cancelling":
      return "Stopping task...";
    case "in_progress":
      return "Task running...";
    case "completed":
      return "Task completed.";
    case "failed":
      return "Task failed.";
    case "cancelled":
      return "Task cancelled.";
    case "incomplete":
      return "Task interrupted.";
    default:
      return "Task status unavailable.";
  }
}

export function getResponsePresentation(response: PlatformResponse): ResponsePresentation {
  if (response.status === "in_progress" && response.retry) {
    return {
      label: response.retry.phase === "waiting" ? "Retry scheduled" : "Retrying model",
      detail: `Attempt ${response.retry.attempt} of ${response.retry.maxAttempts} · run retry ${response.retry.runRetry} of ${response.retry.maxRunRetries} · ${response.retry.reason}`,
      tone: "attention",
    };
  }

  switch (response.status) {
    case "queued":
      return { label: "Task accepted", detail: "Waiting for execution to start.", tone: "active" };
    case "in_progress":
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
    case "awaiting_takeover":
      return {
        label: "Takeover needed",
        detail: "The task is waiting for you to take control.",
        tone: "attention",
      };
    case "cancelling":
      return {
        label: "Stop requested",
        detail: "The task owner has not stopped yet.",
        tone: "attention",
      };
    case "completed":
      return { label: "Task completed", detail: "The final result is available.", tone: "success" };
    case "failed":
      return {
        label: "Task failed",
        detail: response.terminal_reason ?? "The task could not finish.",
        tone: "danger",
      };
    case "cancelled":
      return {
        label: "Task cancelled",
        detail: "Execution stopped after the request was accepted.",
        tone: "neutral",
      };
    case "incomplete":
      return {
        label: "Task interrupted",
        detail: response.terminal_reason ?? "Execution ownership was lost.",
        tone: "danger",
      };
    default:
      return { label: "Task status unavailable", detail: "Refresh to try again.", tone: "neutral" };
  }
}
