import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  knowledgeFeedSchema,
  knowledgeSyncResourceSchema,
  type KnowledgeFeed,
  type KnowledgeSync,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type {
  ConnectorKnowledgeSyncRecord,
  KnowledgeSyncRecord,
} from "~/modules/sources/infrastructure/KnowledgeSyncRepository";

const resourcesSchema = z.array(knowledgeSyncResourceSchema).min(1).max(100);

export function isConnectorKnowledgeSync(
  record: KnowledgeSyncRecord,
): record is ConnectorKnowledgeSyncRecord {
  return (
    record.kind === "connector" &&
    record.connection_id !== null &&
    record.recipe_id !== null &&
    record.integration_id !== null &&
    record.resources !== null
  );
}

export const parseKnowledgeSyncResources = (record: ConnectorKnowledgeSyncRecord) =>
  resourcesSchema.parse(safeParseJson(record.resources));

export const parseKnowledgeFeed = (record: KnowledgeSyncRecord): KnowledgeFeed =>
  knowledgeFeedSchema.parse(safeParseJson(record.feed ?? ""));

export function formatKnowledgeSync(record: KnowledgeSyncRecord, userId: number): KnowledgeSync {
  const connector = isConnectorKnowledgeSync(record);

  return {
    id: record.id,
    projectId: record.project_id,
    notebookId: record.collection_id,
    title: record.title,
    kind: record.kind,
    feed: connector ? null : parseKnowledgeFeed(record),
    status: record.status,
    resourceCount: connector ? parseKnowledgeSyncResources(record).length : 0,
    cursor: record.cursor,
    lastSuccessfulAt: record.last_successful_at,
    lastError: record.last_error,
    nextSyncAt: record.next_sync_at,
    intervalMinutes: record.interval_minutes,
    canManage: ownsResource(userId, record.user_id),
  };
}
