import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "./conversation-types.js";

export interface HandoffRun {
  leadMessageId: string;
  teammateIds: string[];
  messageIds: string[];
}

export function readHandoffTeammateId(message: Message): string | undefined {
  if (message.role !== "assistant" || !isRecord(message.data)) {
    return undefined;
  }

  const { teammateId, trigger, delegationId } = message.data;
  const isHandoff = trigger === "handle" || typeof delegationId === "string";

  return isHandoff && typeof teammateId === "string" ? teammateId : undefined;
}

export function readReplyTeammateId(message: Message): string | undefined {
  return message.role === "assistant" ? (message.provenance?.teammateId ?? undefined) : undefined;
}

export function collectHandoffRuns(messages: readonly Message[]): Map<string, HandoffRun> {
  const runs = new Map<string, HandoffRun>();
  let current: HandoffRun | null = null;

  for (const message of messages) {
    const teammateId = readHandoffTeammateId(message);

    if (!teammateId) {
      current = null;
      continue;
    }

    if (!current) {
      current = { leadMessageId: message.id, teammateIds: [], messageIds: [] };
    }

    current.messageIds.push(message.id);

    if (!current.teammateIds.includes(teammateId)) {
      current.teammateIds.push(teammateId);
    }

    runs.set(message.id, current);
  }

  return runs;
}

export function isCollapsedHandoffFollower(
  runs: ReadonlyMap<string, HandoffRun>,
  expanded: ReadonlySet<string>,
  messageId: string,
): boolean {
  const run = runs.get(messageId);

  return Boolean(run && run.leadMessageId !== messageId && !expanded.has(run.leadMessageId));
}
