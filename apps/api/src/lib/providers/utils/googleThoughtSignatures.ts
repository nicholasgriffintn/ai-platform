import { isRecord } from "~/utils/objects";

export function readGoogleThoughtSignature(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.thoughtSignature === "string") {
    return value.thoughtSignature;
  }

  return typeof value.thought_signature === "string" ? value.thought_signature : undefined;
}
