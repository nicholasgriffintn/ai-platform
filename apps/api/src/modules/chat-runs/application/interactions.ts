import { isRecord } from "@ngriffin_uk/polychat-utility-core";

function readToolInteractionResponse(options: unknown): Record<string, unknown> | undefined {
  if (!isRecord(options) || !isRecord(options.toolInteraction)) {
    return undefined;
  }

  const response = options.toolInteraction.response;

  return isRecord(response) ? response : undefined;
}

export function readToolInteractionId(options: unknown): string | undefined {
  const interactionId = readToolInteractionResponse(options)?.interactionId;

  return typeof interactionId === "string" ? interactionId : undefined;
}

export function readToolInteractionResolution(
  options: unknown,
): "approved" | "rejected" | undefined {
  const resolution = readToolInteractionResponse(options)?.resolution;

  return resolution === "approved" || resolution === "rejected" ? resolution : undefined;
}
