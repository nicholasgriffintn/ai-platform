import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";

export function outputRecord(overrides: Partial<OutputRecord> = {}): OutputRecord {
  return {
    id: "output-1",
    created_by_user_id: 123,
    project_id: null,
    conversation_id: null,
    parent_output_id: null,
    capability_id: "articles",
    group_id: "session-1",
    kind: "analysis",
    title: "Article analysis",
    status: "ready",
    sensitivity: "personal",
    content: "{}",
    storage_key: null,
    mime_type: null,
    filename: null,
    byte_size: null,
    revision: 1,
    created_at: "2026-08-11T10:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

export function articleContext(outputs: Record<string, unknown>): ServiceContext {
  return {
    ensureDatabase: () => undefined,
    repositories: { outputs },
  } as unknown as ServiceContext;
}
