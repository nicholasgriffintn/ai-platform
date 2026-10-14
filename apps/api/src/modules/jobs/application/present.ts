import type { JobStatus } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

export function readJobContent(record: OutputRecord): Record<string, unknown> {
  return safeParseJson<Record<string, unknown>>(record.content) ?? {};
}

export function jobFields(record: OutputRecord) {
  return {
    object: "job" as const,
    id: record.id,
    project_id: record.project_id,
    created_at: record.created_at,
    updated_at: record.updated_at ?? record.created_at,
  };
}

export function jobStatusFromProvider(value: unknown): JobStatus {
  switch (typeof value === "string" ? value.toLowerCase() : "") {
    case "queued":
    case "pending":
    case "starting":
      return "queued";
    case "succeeded":
    case "completed":
    case "complete":
    case "ready":
      return "succeeded";
    case "failed":
    case "error":
    case "errored":
      return "failed";
    case "canceled":
    case "cancelled":
    case "stopped":
      return "cancelled";
    default:
      return "in_progress";
  }
}
