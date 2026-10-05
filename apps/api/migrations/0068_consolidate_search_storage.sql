DROP TRIGGER source_task_snapshot_immutable;
--> statement-breakpoint
CREATE TRIGGER source_task_snapshot_immutable
BEFORE UPDATE OF content, metadata, title, external_uri, provider, project_id ON source
WHEN json_extract(OLD.metadata, '$.immutableSnapshot') = 1
  OR EXISTS (SELECT 1 FROM project_task_integration WHERE source_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Task snapshots are immutable');
END;
--> statement-breakpoint
CREATE TABLE "search_document" (
  "id" TEXT NOT NULL,
  "metadata" TEXT,
  "title" TEXT,
  "content" TEXT,
  "type" TEXT,
  "namespace" TEXT,
  "user_id" INTEGER,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "scope_type" TEXT DEFAULT 'personal',
  "logical_id" TEXT,
  "lifecycle_status" TEXT DEFAULT 'pending',
  "provider" TEXT,
  "provider_target" TEXT DEFAULT 'quarantined-legacy',
  "embedding_model" TEXT DEFAULT 'unknown-legacy',
  "vector_space" TEXT,
  "vector_space_version" TEXT DEFAULT 'legacy',
  "embedding_dimensions" INTEGER DEFAULT 1,
  "distance_metric" TEXT DEFAULT 'unknown',
  "task_mode" TEXT DEFAULT 'unknown',
  "source_id" TEXT,
  "source_revision" INTEGER,
  "project_id" TEXT,
  "status" TEXT DEFAULT 'lexical',
  "target" TEXT,
  "lease_token" TEXT,
  "lease_expires_at" TEXT,
  "document_type" TEXT NOT NULL,
  "legacy_user_id" INTEGER GENERATED ALWAYS AS (CASE WHEN document_type = 'legacy' THEN user_id END) REFERENCES "user"("id") ON DELETE NO ACTION,
  "embedding_user_id" INTEGER GENERATED ALWAYS AS (CASE WHEN document_type = 'embedding' THEN user_id END) REFERENCES "user"("id") ON DELETE CASCADE,
  PRIMARY KEY ("document_type", "id"),
  CHECK (document_type IN ('legacy', 'embedding', 'source')),
  CHECK (document_type != 'embedding' OR (scope_type = 'personal' AND lifecycle_status IN ('pending','active','delete_pending'))),
  CHECK (document_type != 'source' OR (status IN ('lexical','active','stale') AND source_revision > 0)),
  CHECK ((document_type = 'legacy' AND id IS NOT NULL AND created_at IS NOT NULL) OR (document_type = 'embedding' AND id IS NOT NULL AND scope_type IS NOT NULL AND user_id IS NOT NULL AND logical_id IS NOT NULL AND type IS NOT NULL AND title IS NOT NULL AND metadata IS NOT NULL AND lifecycle_status IS NOT NULL AND provider IS NOT NULL AND provider_target IS NOT NULL AND embedding_model IS NOT NULL AND vector_space IS NOT NULL AND vector_space_version IS NOT NULL AND created_at IS NOT NULL AND embedding_dimensions IS NOT NULL AND distance_metric IS NOT NULL AND task_mode IS NOT NULL) OR (document_type = 'source' AND id IS NOT NULL AND source_id IS NOT NULL AND source_revision IS NOT NULL AND user_id IS NOT NULL AND status IS NOT NULL AND target IS NOT NULL AND created_at IS NOT NULL))
);
CREATE INDEX "search_document_legacy_namespace_idx" ON "search_document" ("namespace") WHERE document_type = 'legacy';
CREATE INDEX "search_document_legacy_user_idx" ON "search_document" ("user_id") WHERE document_type = 'legacy';
CREATE INDEX "search_document_legacy_scope_idx" ON "search_document" ("id", "type", "namespace", "user_id") WHERE document_type = 'legacy';
CREATE UNIQUE INDEX "search_document_embedding_logical_idx" ON "search_document" ("user_id", "logical_id") WHERE document_type = 'embedding';
CREATE INDEX "search_document_embedding_lifecycle_idx" ON "search_document" ("user_id", "lifecycle_status") WHERE document_type = 'embedding';
CREATE UNIQUE INDEX "search_document_source_revision_idx" ON "search_document" ("source_id", "source_revision") WHERE document_type = 'source';
CREATE INDEX "search_document_source_scope_idx" ON "search_document" ("project_id", "status") WHERE document_type = 'source';
CREATE INDEX "search_document_source_status_idx" ON "search_document" ("status") WHERE document_type = 'source';
CREATE INDEX "search_document_legacy_owner_idx" ON "search_document" ("legacy_user_id") WHERE legacy_user_id IS NOT NULL;
CREATE INDEX "search_document_embedding_owner_idx" ON "search_document" ("embedding_user_id") WHERE embedding_user_id IS NOT NULL;
INSERT INTO "search_document" ("document_type", "id", "metadata", "title", "content", "type", "namespace", "user_id", "created_at", "updated_at") SELECT 'legacy', "id", "metadata", "title", "content", "type", "namespace", "user_id", "created_at", "updated_at" FROM "embedding";
INSERT INTO "search_document" ("document_type", "id", "scope_type", "user_id", "logical_id", "type", "title", "metadata", "lifecycle_status", "provider", "provider_target", "embedding_model", "vector_space", "vector_space_version", "created_at", "updated_at", "embedding_dimensions", "distance_metric", "task_mode") SELECT 'embedding', "id", "scope_type", "user_id", "logical_id", "type", "title", "metadata", "lifecycle_status", "provider", "provider_target", "embedding_model", "vector_space", "vector_space_version", "created_at", "updated_at", "embedding_dimensions", "distance_metric", "task_mode" FROM "embedding_document";
INSERT INTO "search_document" ("document_type", "id", "source_id", "source_revision", "user_id", "project_id", "status", "target", "lease_token", "lease_expires_at", "created_at") SELECT 'source', "id", "source_id", "source_revision", "user_id", "project_id", "status", "target", "lease_token", "lease_expires_at", "created_at" FROM "source_search_document";
--> statement-breakpoint
CREATE TABLE "search_chunk" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "vector_id" TEXT,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" TEXT,
  "lifecycle_status" TEXT DEFAULT 'pending',
  "provider" TEXT,
  "provider_target" TEXT DEFAULT 'quarantined-legacy',
  "embedding_model" TEXT DEFAULT 'unknown-legacy',
  "vector_space" TEXT,
  "vector_space_version" TEXT DEFAULT 'legacy',
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "embedding_dimensions" INTEGER DEFAULT 1,
  "distance_metric" TEXT DEFAULT 'unknown',
  "task_mode" TEXT DEFAULT 'unknown',
  "title" TEXT,
  "document_type" TEXT NOT NULL,
  PRIMARY KEY ("document_type", "id"),
  FOREIGN KEY ("document_type", "document_id") REFERENCES "search_document"("document_type", "id") ON DELETE CASCADE,
  CHECK (document_type IN ('embedding', 'source')),
  CHECK (document_type != 'embedding' OR lifecycle_status IN ('pending','active','delete_pending')),
  CHECK ((document_type = 'embedding' AND id IS NOT NULL AND document_id IS NOT NULL AND vector_id IS NOT NULL AND chunk_index IS NOT NULL AND content IS NOT NULL AND metadata IS NOT NULL AND lifecycle_status IS NOT NULL AND provider IS NOT NULL AND provider_target IS NOT NULL AND embedding_model IS NOT NULL AND vector_space IS NOT NULL AND vector_space_version IS NOT NULL AND created_at IS NOT NULL AND embedding_dimensions IS NOT NULL AND distance_metric IS NOT NULL AND task_mode IS NOT NULL) OR (document_type = 'source' AND id IS NOT NULL AND document_id IS NOT NULL AND chunk_index IS NOT NULL AND title IS NOT NULL AND content IS NOT NULL))
);
CREATE UNIQUE INDEX "search_chunk_embedding_ordinal_idx" ON "search_chunk" ("document_id", "chunk_index") WHERE document_type = 'embedding';
CREATE UNIQUE INDEX "search_chunk_embedding_vector_idx" ON "search_chunk" ("vector_id") WHERE document_type = 'embedding';
CREATE INDEX "search_chunk_document_idx" ON "search_chunk" ("document_type", "document_id");
CREATE INDEX "search_chunk_embedding_lifecycle_idx" ON "search_chunk" ("document_id", "lifecycle_status") WHERE document_type = 'embedding';
INSERT INTO "search_chunk" ("document_type", "id", "document_id", "vector_id", "chunk_index", "content", "metadata", "lifecycle_status", "provider", "provider_target", "embedding_model", "vector_space", "vector_space_version", "created_at", "updated_at", "embedding_dimensions", "distance_metric", "task_mode") SELECT 'embedding', "id", "document_id", "vector_id", "chunk_index", "content", "metadata", "lifecycle_status", "provider", "provider_target", "embedding_model", "vector_space", "vector_space_version", "created_at", "updated_at", "embedding_dimensions", "distance_metric", "task_mode" FROM "embedding_chunk";
INSERT INTO "search_chunk" ("document_type", "id", "document_id", "chunk_index", "title", "content") SELECT 'source', "id", "document_id", "chunk_index", "title", "content" FROM "source_search_chunk";
--> statement-breakpoint
CREATE TABLE memory_reflection (
  record_kind TEXT NOT NULL,
  id TEXT NOT NULL,
  context_id TEXT NOT NULL REFERENCES teammate_context(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  through_message_id TEXT NOT NULL,
  revision INTEGER,
  status TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (record_kind, id),
  CHECK (record_kind = 'checkpoint' OR (record_kind = 'result' AND revision IS NOT NULL AND status IS NOT NULL AND status IN ('applied', 'no_change') AND evidence_json IS NOT NULL))
);
CREATE UNIQUE INDEX memory_reflection_checkpoint_idx ON memory_reflection(context_id, conversation_id) WHERE record_kind = 'checkpoint';
CREATE INDEX memory_reflection_context_idx ON memory_reflection(context_id);
CREATE INDEX memory_reflection_conversation_idx ON memory_reflection(conversation_id);
INSERT INTO memory_reflection (record_kind, id, context_id, conversation_id, through_message_id, updated_at)
SELECT 'checkpoint', id, context_id, conversation_id, message_id, updated_at FROM memory_reflection_checkpoint;
INSERT INTO memory_reflection (record_kind, id, context_id, conversation_id, through_message_id, revision, status, evidence_json, created_at)
SELECT 'result', id, context_id, conversation_id, through_message_id, revision, status, evidence_json, created_at FROM memory_reflection_result;
--> statement-breakpoint
CREATE TABLE __search_storage_copy_check (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
INSERT INTO __search_storage_copy_check SELECT (SELECT count(*) FROM embedding) = (SELECT count(*) FROM search_document WHERE document_type = 'legacy');
--> statement-breakpoint
INSERT INTO __search_storage_copy_check SELECT (SELECT count(*) FROM embedding_document) = (SELECT count(*) FROM search_document WHERE document_type = 'embedding');
--> statement-breakpoint
INSERT INTO __search_storage_copy_check SELECT (SELECT count(*) FROM source_search_document) = (SELECT count(*) FROM search_document WHERE document_type = 'source');
--> statement-breakpoint
INSERT INTO __search_storage_copy_check SELECT (SELECT count(*) FROM embedding_chunk) = (SELECT count(*) FROM search_chunk WHERE document_type = 'embedding');
--> statement-breakpoint
INSERT INTO __search_storage_copy_check SELECT (SELECT count(*) FROM source_search_chunk) = (SELECT count(*) FROM search_chunk WHERE document_type = 'source');
--> statement-breakpoint
INSERT INTO __search_storage_copy_check SELECT (SELECT count(*) FROM memory_reflection_checkpoint) = (SELECT count(*) FROM memory_reflection WHERE record_kind = 'checkpoint');
--> statement-breakpoint
INSERT INTO __search_storage_copy_check SELECT (SELECT count(*) FROM memory_reflection_result) = (SELECT count(*) FROM memory_reflection WHERE record_kind = 'result');
--> statement-breakpoint
DROP TABLE __search_storage_copy_check;
--> statement-breakpoint
DROP TRIGGER source_search_chunk_insert;
--> statement-breakpoint
DROP TRIGGER source_search_chunk_delete;
--> statement-breakpoint
DROP TRIGGER source_search_revision_update;
--> statement-breakpoint
DROP TRIGGER source_search_revision_delete;
--> statement-breakpoint
DROP TABLE source_search_fts;
--> statement-breakpoint
DROP TABLE "source_search_chunk";
--> statement-breakpoint
DROP TABLE "embedding_chunk";
--> statement-breakpoint
DROP TABLE "source_search_document";
--> statement-breakpoint
DROP TABLE "embedding_document";
--> statement-breakpoint
DROP TABLE "embedding";
--> statement-breakpoint
DROP TABLE "memory_reflection_checkpoint";
--> statement-breakpoint
DROP TABLE "memory_reflection_result";
--> statement-breakpoint
CREATE VIEW search_fts_content AS SELECT rowid, title, content FROM search_chunk WHERE document_type = 'source';
--> statement-breakpoint
CREATE VIRTUAL TABLE search_fts USING fts5(title, content, content='search_fts_content', content_rowid='rowid', tokenize='unicode61');
--> statement-breakpoint
INSERT INTO search_fts(search_fts) VALUES ('rebuild');
--> statement-breakpoint
CREATE TRIGGER search_chunk_insert AFTER INSERT ON search_chunk WHEN new.document_type = 'source' BEGIN
  INSERT INTO search_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER search_chunk_delete AFTER DELETE ON search_chunk WHEN old.document_type = 'source' BEGIN
  INSERT INTO search_fts(search_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
--> statement-breakpoint
CREATE TRIGGER search_chunk_update AFTER UPDATE OF title, content ON search_chunk WHEN new.document_type = 'source' BEGIN
  INSERT INTO search_fts(search_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO search_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER source_search_revision_update
AFTER UPDATE OF content, title, status, project_id, created_by_user_id, external_uri, kind, connection_id ON source
WHEN old.content IS NOT new.content OR old.title IS NOT new.title OR old.status IS NOT new.status
  OR old.project_id IS NOT new.project_id OR old.created_by_user_id IS NOT new.created_by_user_id
  OR old.external_uri IS NOT new.external_uri OR old.kind IS NOT new.kind OR old.connection_id IS NOT new.connection_id
BEGIN
  UPDATE source SET search_revision = old.search_revision + 1 WHERE id = new.id;
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND source_id = new.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_search_revision_delete AFTER DELETE ON source BEGIN
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND source_id = old.id;
END;
