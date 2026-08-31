import { safeParseJson } from "~/utils/json";

interface OutputContentRecord {
  content: string | Record<string, unknown> | null | undefined;
}

export function parseOutputContent(value: OutputContentRecord["content"]): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value;
  }

  return typeof value === "string" ? (safeParseJson<Record<string, unknown>>(value) ?? {}) : {};
}

export function isOutputDeletionPending(record: OutputContentRecord): boolean {
  return parseOutputContent(record.content).deletionPending === true;
}

export function withOutputDeletionPending(
  content: Record<string, unknown>,
): Record<string, unknown> {
  return { ...content, deletionPending: true };
}
