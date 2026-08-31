import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types";

const COUNCIL_TOOL_NAME = "select_council_members";
const LEGACY_COUNCIL_PROMPT_PREFIX = "Convene the council with these members: ";

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

function getPendingData(message: Message, partIndex?: number): Record<string, unknown> | null {
  if (partIndex === undefined) {
    return isRecord(message.data) ? message.data : null;
  }

  const part = message.parts?.[partIndex];

  return part?.type === "tool_result" && isRecord(part.data) ? part.data : null;
}

function readLegacyCouncilResolution(
  message: Message,
  pending: readonly PendingToolInteraction[] | undefined,
  projected: readonly Message[],
): ToolInteractionResolution | null {
  if (
    message.role !== "user" ||
    typeof message.content !== "string" ||
    !message.content.startsWith(LEGACY_COUNCIL_PROMPT_PREFIX) ||
    !pending?.length
  ) {
    return null;
  }

  const target = pending.at(-1);
  const pendingMessage = target ? projected[target.messageIndex] : undefined;
  const data = pendingMessage ? getPendingData(pendingMessage, target?.partIndex) : null;
  const members = Array.isArray(data?.members) ? data.members : [];
  const memberIdByName = new Map(
    members.flatMap((member) =>
      isRecord(member) && typeof member.id === "string" && typeof member.name === "string"
        ? [[member.name, member.id] as const]
        : [],
    ),
  );
  const selectedNames = message.content
    .slice(LEGACY_COUNCIL_PROMPT_PREFIX.length)
    .replace(/\.$/, "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const memberIds = selectedNames.flatMap((name) => {
    const memberId = memberIdByName.get(name);

    return memberId ? [memberId] : [];
  });

  if (memberIds.length === 0 || memberIds.length !== selectedNames.length) {
    return null;
  }

  return {
    toolName: COUNCIL_TOOL_NAME,
    response: { memberIds },
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

    const interaction =
      readStructuredResolution(message) ??
      readLegacyCouncilResolution(message, pendingByToolName.get(COUNCIL_TOOL_NAME), projected);

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
