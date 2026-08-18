import {
  type SandboxRunData,
  type SandboxRunEvent,
  type SandboxRunStatus,
  sandboxRunDataSchema,
} from "@ngriffin_uk/polychat-schemas";

export { type SandboxRunData, type SandboxRunStatus };

export function parseSandboxRunData(value: unknown): SandboxRunData | null {
  const parsed = sandboxRunDataSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function getSandboxActivityStatus(
  status: SandboxRunStatus,
): "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled" {
  switch (status) {
    case "paused":
      return "waiting";
    case "completed":
      return "succeeded";
    default:
      return status;
  }
}

export function appendSandboxRunEvent(
  events: SandboxRunEvent[] | undefined,
  event: SandboxRunEvent,
  maxEvents: number,
): SandboxRunEvent[] {
  const next = [...(events ?? []), event];

  if (next.length <= maxEvents) {
    return next;
  }

  return next.slice(next.length - maxEvents);
}
