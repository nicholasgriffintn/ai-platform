ALTER TABLE source ADD COLUMN knowledge_revision INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
INSERT INTO source (id, created_by_user_id, kind, title, status, content, metadata, external_uri)
SELECT 'knowledge_' || d.id, d.user_id,
  CASE WHEN d.type = 'webpage' THEN 'url' ELSE 'text' END,
  COALESCE(NULLIF(d.title, ''), 'Saved content'), 'available',
  (SELECT group_concat(content, char(10) || char(10)) FROM
    (SELECT c.content FROM embedding_chunk c WHERE c.document_id = d.id AND c.lifecycle_status = 'active' ORDER BY c.chunk_index)),
  COALESCE(d.metadata, '{}'),
  CASE WHEN json_valid(d.metadata) THEN
    CASE WHEN json_type(d.metadata, '$.url') = 'text' AND length(json_extract(d.metadata, '$.url')) <= 2048
      THEN json_extract(d.metadata, '$.url') END END
FROM embedding_document d
WHERE d.scope_type = 'personal' AND d.lifecycle_status = 'active' AND d.type NOT IN ('memory', 'sandbox_run');
--> statement-breakpoint
WITH runs AS (
  SELECT a.*, CASE WHEN json_valid(a.data) THEN a.data ELSE '{}' END AS safe_data,
    row_number() OVER (PARTITION BY a.group_id ORDER BY a.updated_at DESC, a.id DESC) AS latest
  FROM activity_record a WHERE a.capability_id = 'sandbox_runs' AND a.group_id IS NOT NULL
)
INSERT INTO source (id, created_by_user_id, project_id, kind, title, status, content, metadata)
SELECT 'sandbox-run-' || r.group_id, r.created_by_user_id, r.project_id, 'repository',
  substr('Sandbox run ' || r.group_id, 1, 200), 'available',
  substr('Repository: ' || COALESCE(json_extract(r.safe_data, '$.repo'), '') || char(10) ||
    'Task: ' || COALESCE(json_extract(r.safe_data, '$.task'), '') || char(10) ||
    'Status: ' || json_extract(r.safe_data, '$.status') || char(10) ||
    COALESCE(json_extract(r.safe_data, '$.result.summary'), '') || char(10) ||
    COALESCE(json_extract(r.safe_data, '$.error'), '') || char(10) ||
    COALESCE(json_extract(r.safe_data, '$.result.diff'), ''), 1, 12000),
  json_object('runId', r.group_id, 'repo', json_extract(r.safe_data, '$.repo'))
FROM runs r JOIN user u ON u.id = r.created_by_user_id
WHERE r.latest = 1 AND json_extract(r.safe_data, '$.runId') = r.group_id
  AND json_extract(r.safe_data, '$.status') IN ('completed', 'failed')
  AND NOT EXISTS (SELECT 1 FROM runs other WHERE other.group_id = r.group_id
    AND (other.created_by_user_id <> r.created_by_user_id OR other.project_id IS NOT r.project_id));
--> statement-breakpoint
CREATE TABLE source_index (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_by_user_id INTEGER NOT NULL,
  target TEXT NOT NULL CHECK (json_valid(target)),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('pending', 'active', 'failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  indexed_at TEXT,
  cleanup_after TEXT,
  legacy_document_id TEXT REFERENCES embedding_document(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX source_index_revision_idx ON source_index(source_id, revision);
--> statement-breakpoint
CREATE TABLE source_chunk (
  id TEXT PRIMARY KEY NOT NULL,
  index_id TEXT NOT NULL REFERENCES source_index(id) ON DELETE CASCADE,
  vector_id TEXT NOT NULL UNIQUE,
  chunk_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX source_chunk_index_idx ON source_chunk(index_id, chunk_index);
--> statement-breakpoint
CREATE INDEX source_index_source_idx ON source_index(source_id, revision, lifecycle_status);
--> statement-breakpoint
CREATE VIRTUAL TABLE source_chunk_fts USING fts5(title, content, content='source_chunk', content_rowid='rowid');
--> statement-breakpoint
CREATE TRIGGER source_chunk_fts_insert AFTER INSERT ON source_chunk BEGIN
  INSERT INTO source_chunk_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER source_chunk_fts_delete AFTER DELETE ON source_chunk BEGIN
  INSERT INTO source_chunk_fts(source_chunk_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
--> statement-breakpoint
CREATE TRIGGER source_chunk_fts_update AFTER UPDATE ON source_chunk BEGIN
  INSERT INTO source_chunk_fts(source_chunk_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO source_chunk_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
--> statement-breakpoint
INSERT INTO source_index (id, source_id, revision, created_by_user_id, target, lifecycle_status, legacy_document_id)
SELECT 'retired_' || d.id, 'retired_' || d.id, 1, d.user_id,
  json_object('embeddingProvider', d.provider, 'providerTarget', d.provider_target, 'model', d.embedding_model,
    'dimensions', d.embedding_dimensions, 'distanceMetric', d.distance_metric, 'taskMode', d.task_mode,
    'vectorSpace', d.vector_space, 'vectorSpaceVersion', d.vector_space_version),
  'failed', d.id
FROM embedding_document d WHERE d.scope_type = 'personal' AND d.lifecycle_status = 'active' AND d.type <> 'memory';
--> statement-breakpoint
INSERT INTO source_chunk (id, index_id, vector_id, chunk_index, title, content)
SELECT 'retired_' || c.id, i.id, c.vector_id, c.chunk_index, d.title, c.content
FROM source_index i JOIN embedding_document d ON d.id = i.legacy_document_id
  JOIN embedding_chunk c ON c.document_id = d.id;
--> statement-breakpoint
UPDATE embedding_chunk SET lifecycle_status = 'delete_pending'
WHERE document_id IN (SELECT legacy_document_id FROM source_index WHERE legacy_document_id IS NOT NULL);
--> statement-breakpoint
UPDATE embedding_document SET lifecycle_status = 'delete_pending'
WHERE id IN (SELECT legacy_document_id FROM source_index WHERE legacy_document_id IS NOT NULL);
--> statement-breakpoint
CREATE TRIGGER source_knowledge_revision AFTER UPDATE OF title, content, project_id, connection_id ON source
WHEN old.title IS NOT new.title OR old.content IS NOT new.content
  OR old.project_id IS NOT new.project_id OR old.connection_id IS NOT new.connection_id
BEGIN
  UPDATE source SET knowledge_revision = old.knowledge_revision + 1 WHERE id = new.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_connection_deleted BEFORE DELETE ON provider_connection BEGIN
  UPDATE source SET status = 'archived' WHERE connection_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_knowledge_restored AFTER UPDATE OF status ON source
WHEN old.status <> 'available' AND new.status = 'available'
BEGIN
  UPDATE source SET knowledge_revision = knowledge_revision + 1 WHERE id = new.id;
END;
