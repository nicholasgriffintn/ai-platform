import type { OutputRecord } from "~/repositories/OutputRepository";
import { safeParseJson } from "~/utils/json";

import type { CanvasGenerationListItem, CanvasGenerationStatus, CanvasMode } from "./types";

function normalizeMode(value: unknown): CanvasMode | undefined {
  if (value === "image" || value === "video") {
    return value;
  }

  return undefined;
}

function normalizeStatus(value: unknown): CanvasGenerationStatus {
  if (typeof value !== "string") {
    return "processing";
  }

  switch (value.toLowerCase()) {
    case "queued":
      return "queued";
    case "processing":
    case "in_progress":
    case "starting":
      return "processing";
    case "succeeded":
      return "succeeded";
    case "completed":
      return "completed";
    case "failed":
    case "error":
    case "canceled":
    case "cancelled":
      return "failed";
    default:
      return "processing";
  }
}

export function mapCanvasGenerationRecord(record: OutputRecord): CanvasGenerationListItem {
  const data = safeParseJson(record.content) as Record<string, unknown> | null;
  const predictionData =
    data?.predictionData && typeof data.predictionData === "object"
      ? (data.predictionData as Record<string, unknown>)
      : undefined;
  const status = normalizeStatus(data?.status);
  const mode = normalizeMode(data?.mode);
  const input =
    data?.input && typeof data.input === "object"
      ? (data.input as Record<string, unknown>)
      : undefined;

  return {
    id: record.id,
    itemId: record.group_id,
    modelId: typeof data?.modelId === "string" ? data.modelId : record.group_id || record.id,
    modelName: typeof data?.modelName === "string" ? data.modelName : undefined,
    provider: typeof data?.provider === "string" ? data.provider : undefined,
    mode,
    status,
    createdAt: typeof data?.createdAt === "string" ? data.createdAt : record.created_at,
    updatedAt: record.updated_at ?? record.created_at,
    input,
    output: data?.output,
    error: typeof data?.error === "string" ? data.error : undefined,
    predictionData,
  };
}
