import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { knowledgeSyncPageSchema, type KnowledgeSync } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { KnowledgeSyncRecord } from "../infrastructure/KnowledgeSyncRepository";

const pagesSchema = z.array(knowledgeSyncPageSchema).min(1).max(100);

export const parseKnowledgeSyncPages = (record: KnowledgeSyncRecord) =>
  pagesSchema.parse(safeParseJson(record.pages));

export function formatKnowledgeSync(record: KnowledgeSyncRecord, userId: number): KnowledgeSync {
  return {
    id: record.id,
    projectId: record.project_id,
    title: record.title,
    status: record.status,
    pageCount: parseKnowledgeSyncPages(record).length,
    cursor: record.cursor,
    lastSuccessfulAt: record.last_successful_at,
    lastError: record.last_error,
    nextSyncAt: record.next_sync_at,
    intervalMinutes: record.interval_minutes,
    canManage: ownsResource(userId, record.user_id),
  };
}
