import { isRecord } from "~/utils/objects";

export function readToolInteractionId(options: unknown): string | undefined {
  if (!isRecord(options) || !isRecord(options.toolInteraction)) {
    return undefined;
  }

  const response = options.toolInteraction.response;

  return isRecord(response) && typeof response.interactionId === "string"
    ? response.interactionId
    : undefined;
}
