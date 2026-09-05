import type { ChatTurnActivityEvent } from "@ngriffin_uk/polychat-schemas/chat-stream";

export type TurnActivityPhase =
  | "preparing"
  | "reasoning"
  | "generating"
  | "preparing_tool"
  | "using_tools"
  | "finalising"
  | "waiting"
  | "reconnecting"
  | "completed"
  | "failed"
  | "cancelled";

export interface TurnActivityTool {
  id: string;
  name: string;
  status: "preparing" | "running" | "success" | "failure";
}

export interface TurnActivityProjection {
  phase: TurnActivityPhase;
  label: string;
  step?: number;
  tools: TurnActivityTool[];
  requiresAction: boolean;
}

const WAITING_FOR_USER_LABELS = {
  question: "Waiting for your answer.",
  approval: "Waiting for your approval.",
  selection: "Waiting for your selection.",
} as const;

export function createTurnActivityProjection(): TurnActivityProjection {
  return {
    phase: "preparing",
    label: "Preparing response...",
    tools: [],
    requiresAction: false,
  };
}

function updateTool(
  projection: TurnActivityProjection,
  event: Extract<ChatTurnActivityEvent, { toolCallId: string }>,
  status: TurnActivityTool["status"],
): TurnActivityTool[] {
  const existing = projection.tools.find((tool) => tool.id === event.toolCallId);

  if (!existing) {
    return [...projection.tools, { id: event.toolCallId, name: event.toolName, status }];
  }

  return projection.tools.map((tool) =>
    tool.id === event.toolCallId ? { ...tool, name: event.toolName, status } : tool,
  );
}

function toolExecutionLabel(tools: TurnActivityTool[]): string {
  const running = tools.filter((tool) => tool.status === "running");

  if (running.length === 1) {
    return `Running ${running[0].name}...`;
  }

  return running.length > 1 ? `Running ${running.length} tools...` : "Preparing next step...";
}

export function applyTurnActivityEvent(
  projection: TurnActivityProjection,
  event: ChatTurnActivityEvent,
): TurnActivityProjection {
  switch (event.kind) {
    case "turn_started":
      return createTurnActivityProjection();
    case "model_step_started":
      return {
        ...projection,
        phase: "preparing",
        label: "Preparing next step...",
        step: event.step,
      };
    case "reasoning_started":
      return { ...projection, phase: "reasoning", label: "Reasoning...", step: event.step };
    case "reasoning_finished":
      return {
        ...projection,
        phase: "preparing",
        label: "Preparing next step...",
        step: event.step,
      };
    case "response_started":
      return {
        ...projection,
        phase: "generating",
        label: "Generating response...",
        step: event.step,
      };
    case "response_finished":
      return {
        ...projection,
        phase: "finalising",
        label: "Finalising response...",
        step: event.step,
      };
    case "tool_input_started": {
      const tools = updateTool(projection, event, "preparing");

      return {
        ...projection,
        phase: "preparing_tool",
        label: `Preparing ${event.toolName}...`,
        step: event.step,
        tools,
      };
    }

    case "tool_input_finished":
      return { ...projection, step: event.step };
    case "tool_execution_started": {
      const tools = updateTool(projection, event, "running");

      return {
        ...projection,
        phase: "using_tools",
        label: toolExecutionLabel(tools),
        step: event.step,
        tools,
      };
    }

    case "tool_finished": {
      const tools = updateTool(projection, event, event.outcome);

      return {
        ...projection,
        phase: tools.some((tool) => tool.status === "running") ? "using_tools" : "preparing",
        label:
          event.outcome === "failure"
            ? `${event.toolName} failed. Continuing...`
            : toolExecutionLabel(tools),
        step: event.step,
        tools,
      };
    }

    case "waiting_for_user":
      return {
        ...projection,
        phase: "waiting",
        label: waitingForUserLabel(event.reason),
        step: event.step,
        tools: updateTool(projection, event, "preparing"),
        requiresAction: true,
      };
    case "model_step_finished":
      return event.outcome === "failed"
        ? { ...projection, phase: "failed", label: "Response failed.", step: event.step }
        : { ...projection, step: event.step };
    case "turn_finished":
      if (event.outcome === "waiting") {
        return { ...projection, phase: "waiting", requiresAction: true };
      }

      return {
        ...projection,
        phase: event.outcome,
        label:
          event.outcome === "completed"
            ? "Response complete."
            : event.outcome === "cancelled"
              ? "Response stopped."
              : "Response failed.",
      };
  }

  return projection;
}

function waitingForUserLabel(reason: keyof typeof WAITING_FOR_USER_LABELS): string {
  return WAITING_FOR_USER_LABELS[reason];
}

export function markTurnActivityReconnecting(
  projection: TurnActivityProjection | null,
): TurnActivityProjection {
  return {
    ...(projection ?? createTurnActivityProjection()),
    phase: "reconnecting",
    label: "Reconnecting to the response...",
  };
}
