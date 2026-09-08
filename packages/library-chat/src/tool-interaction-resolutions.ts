import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types.js";

interface ToolInteractionResolution {
  toolName: string;
  response: Record<string, unknown>;
}

interface PendingToolInteraction {
  messageIndex: number;
  partIndex?: number;
}

function readStructuredResolution(message: Message): ToolInteractionResolution | null {
  if (message.role !== "user" || !isRecord(message.data)) {
    return null;
  }

  const interaction = message.data.toolInteraction;

  if (
    !isRecord(interaction) ||
    typeof interaction.toolName !== "string" ||
    !interaction.toolName ||
    !isRecord(interaction.response)
  ) {
    return null;
  }

  return {
    toolName: interaction.toolName,
    response: interaction.response,
  };
}

function buildResolvedToolData(
  data: unknown,
  response: Record<string, unknown>,
): Record<string, unknown> {
  const current = isRecord(data) ? data : {};
  const currentHumanState = isRecord(current.humanInTheLoop) ? current.humanInTheLoop : {};

  return {
    ...current,
    resolved: true,
    resolution: response,
    ...(Object.keys(currentHumanState).length > 0
      ? {
          humanInTheLoop: {
            ...currentHumanState,
            status: "resolved",
            requires_user_action: false,
          },
        }
      : {}),
  };
}

function resolvePendingToolInteraction(
  message: Message,
  interaction: ToolInteractionResolution,
  partIndex?: number,
): Message {
  if (partIndex !== undefined) {
    return {
      ...message,
      parts: message.parts?.map((part, index) =>
        index === partIndex && part.type === "tool_result"
          ? {
              ...part,
              status: "completed",
              data: buildResolvedToolData(part.data, interaction.response),
            }
          : part,
      ),
    };
  }

  return {
    ...message,
    status: "completed",
    data: buildResolvedToolData(message.data, interaction.response),
    parts: message.parts?.map((part) =>
      part.type === "tool_result" && (!part.name || part.name === interaction.toolName)
        ? {
            ...part,
            status: "completed",
            data: buildResolvedToolData(part.data, interaction.response),
          }
        : part,
    ),
  };
}

/**
 * Project append-only user interaction records onto their earlier pending tool result so stored
 * conversations and optimistic streams render the same terminal state.
 */
export function applyToolInteractionResolutions(messages: readonly Message[]): Message[] {
  const projected: Message[] = [];
  const pendingByToolName = new Map<string, PendingToolInteraction[]>();

  messages.forEach((message, messageIndex) => {
    projected.push(message);

    if (message.role === "tool" && message.name && message.status === "pending") {
      const pending = pendingByToolName.get(message.name) ?? [];

      pending.push({ messageIndex });
      pendingByToolName.set(message.name, pending);
    } else {
      message.parts?.forEach((part, partIndex) => {
        if (part.type !== "tool_result" || !part.name || part.status !== "pending") {
          return;
        }

        const pending = pendingByToolName.get(part.name) ?? [];

        pending.push({ messageIndex, partIndex });
        pendingByToolName.set(part.name, pending);
      });
    }

    const interaction = readStructuredResolution(message);

    if (!interaction) {
      return;
    }

    const pending = pendingByToolName.get(interaction.toolName);
    const target = pending?.pop();

    if (!target) {
      return;
    }

    projected[target.messageIndex] = resolvePendingToolInteraction(
      projected[target.messageIndex],
      interaction,
      target.partIndex,
    );
  });

  return projected;
}
