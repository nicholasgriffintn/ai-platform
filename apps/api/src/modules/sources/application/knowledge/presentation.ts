import type { RepositoryKnowledgeSyncRecord } from "~/modules/sources/infrastructure/RepositoryKnowledgeSyncRepository";

export function formatKnowledgeSync(record: RepositoryKnowledgeSyncRecord) {
  return {
    id: record.id,
    projectId: record.project_id,
    createdByUserId: record.created_by_user_id,
    repository: record.repository,
    branch: record.branch,
    path: record.path,
    installationId: record.installation_id,
    status: record.status,
    revision: record.revision,
    documentCount: record.document_count ?? 0,
    lastSyncedAt: record.last_synced_at,
    lastCommit: record.last_commit,
    nextSyncAt: new Date(record.next_sync_at).toISOString(),
    errorMessage: record.error_message,
  };
}
