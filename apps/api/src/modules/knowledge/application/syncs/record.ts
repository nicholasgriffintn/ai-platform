import { getKnowledgeConnectorDescriptor } from "@ngriffin_uk/polychat-ai-integrations";
import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  knowledgeFeedSchema,
  knowledgeSyncCheckpointSchema,
  knowledgeSyncResourceSchema,
  type KnowledgeConnectorDescriptor,
  type KnowledgeFeed,
  type KnowledgeSync,
  type KnowledgeSyncCheckpoint,
  type KnowledgeSyncDescriptorResource,
  type KnowledgeSyncResource,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type {
  ConnectorKnowledgeSyncRecord,
  KnowledgeSyncRecord,
} from "~/modules/knowledge/infrastructure/KnowledgeSyncRepository";

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

export function requireKnowledgeDescriptor(
  resource: KnowledgeSyncDescriptorResource,
  provider: string,
): KnowledgeConnectorDescriptor {
  const descriptor = getKnowledgeConnectorDescriptor(resource.descriptor.id);

  if (!descriptor || descriptor.provider !== provider) {
    throw new AssistantError(
      "This sync uses a document type that is no longer available",
      ErrorType.CONFIGURATION_ERROR,
      400,
    );
  }

  for (const parameter of descriptor.parameters) {
    if (parameter.required && !resource.descriptor.parameters[parameter.name]?.trim()) {
      throw new AssistantError(
        `Enter ${parameter.label.toLowerCase()}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  return descriptor;
}

export function knowledgeSyncResourceOperations(
  resource: KnowledgeSyncResource,
  provider: string,
): string[] {
  if (!("descriptor" in resource)) {
    return [resource.operation];
  }

  const descriptor = requireKnowledgeDescriptor(resource, provider);

  return descriptor.read
    ? [descriptor.list.operation, descriptor.read.operation]
    : [descriptor.list.operation];
}

export const parseKnowledgeSyncCheckpoint = (
  record: KnowledgeSyncRecord,
): KnowledgeSyncCheckpoint =>
  knowledgeSyncCheckpointSchema.parse(safeParseJson(record.checkpoint ?? "") ?? {});

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
