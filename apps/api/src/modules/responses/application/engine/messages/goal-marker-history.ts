import { isGoalMarkerMessage } from "@ngriffin_uk/polychat-schemas";

import type { Message } from "~/types";

function readTimestamp(message: Message): number | undefined {
  return typeof message.timestamp === "number" && Number.isFinite(message.timestamp)
    ? message.timestamp
    : undefined;
}

export function withoutGoalMarkerMessages(messages: Message[]): Message[] {
  return messages.filter((message) => !isGoalMarkerMessage(message));
}

export function mergeStoredGoalMarkers(
  storedMessages: Message[],
  incomingMessages: Message[],
): Message[] {
  const incomingIds = new Set(
    incomingMessages.flatMap((message) => (message.id ? [message.id] : [])),
  );
  const missingMarkers = storedMessages.filter(
    (message) => isGoalMarkerMessage(message) && (!message.id || !incomingIds.has(message.id)),
  );

  if (missingMarkers.length === 0) {
    return incomingMessages;
  }

  const merged = [...incomingMessages];

  for (const marker of missingMarkers) {
    const markerTimestamp = readTimestamp(marker);
    const insertAt =
      markerTimestamp === undefined
        ? merged.length
        : merged.findIndex((message) => {
            const messageTimestamp = readTimestamp(message);

            return messageTimestamp !== undefined && messageTimestamp > markerTimestamp;
          });

    merged.splice(insertAt === -1 ? merged.length : insertAt, 0, marker);
  }

  return merged;
}
