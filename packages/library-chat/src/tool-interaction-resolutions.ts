import { mergeHumanInTheLoop } from "@ngriffin_uk/polychat-library-interactions";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types.js";

interface ToolInteractionResolution {
  toolName: string;
  response: Record<string, unknown>;
}

interface PendingToolInteraction {
  messageIndex: number;
  partIndex?: number;
  toolCallId?: string;
}

function readResolution(interaction: unknown): ToolInteractionResolution[] {
  if (
    !isRecord(interaction) ||
    typeof interaction.toolName !== "string" ||
    !interaction.toolName ||
    !isRecord(interaction.response)
  ) {
    return [];
  }

  return [{ toolName: interaction.toolName, response: interaction.response }];
}

function readStructuredResolutions(message: Message): ToolInteractionResolution[] {
  if (message.role !== "user" || !isRecord(message.data)) {
    return [];
  }

  const { toolInteraction, toolInteractions } = message.data;

  return Array.isArray(toolInteractions)
    ? toolInteractions.flatMap(readResolution)
    : readResolution(toolInteraction);
}

function takePendingTarget(
  pending: PendingToolInteraction[] | undefined,
  interaction: ToolInteractionResolution,
): PendingToolInteraction | undefined {
  if (!pending) {
    return undefined;
  }

  const interactionId = interaction.response.interactionId;
  const index =
    typeof interactionId === "string"
      ? pending.findIndex((candidate) => candidate.toolCallId === interactionId)
      : -1;

  return index >= 0 ? pending.splice(index, 1)[0] : pending.pop();
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
          humanInTheLoop: mergeHumanInTheLoop(currentHumanState, {
            status: "resolved",
            requires_user_action: false,
          }),
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

export function applyToolInteractionResolutions(messages: readonly Message[]): Message[] {
  const projected: Message[] = [];
  const pendingByToolName = new Map<string, PendingToolInteraction[]>();

  messages.forEach((message, messageIndex) => {
    projected.push(message);

    if (message.role === "tool" && message.name && message.status === "pending") {
      const pending = pendingByToolName.get(message.name) ?? [];

      pending.push({ messageIndex, toolCallId: message.tool_call_id });
      pendingByToolName.set(message.name, pending);
    } else {
      message.parts?.forEach((part, partIndex) => {
        if (part.type !== "tool_result" || !part.name || part.status !== "pending") {
          return;
        }

        const pending = pendingByToolName.get(part.name) ?? [];

        pending.push({ messageIndex, partIndex, toolCallId: part.toolCallId });
        pendingByToolName.set(part.name, pending);
      });
    }

    for (const interaction of readStructuredResolutions(message)) {
      const target = takePendingTarget(pendingByToolName.get(interaction.toolName), interaction);

      if (target) {
        projected[target.messageIndex] = resolvePendingToolInteraction(
          projected[target.messageIndex],
          interaction,
          target.partIndex,
        );
      }
    }
  });

  return projected;
}
