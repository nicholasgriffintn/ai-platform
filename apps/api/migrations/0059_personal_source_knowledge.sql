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
DROP TRIGGER source_search_revision_update;
--> statement-breakpoint
CREATE TRIGGER source_search_revision_update
AFTER UPDATE OF content, title, status, project_id, created_by_user_id, external_uri, kind, connection_id ON source
WHEN old.content IS NOT new.content OR old.title IS NOT new.title OR old.status IS NOT new.status
  OR old.project_id IS NOT new.project_id OR old.created_by_user_id IS NOT new.created_by_user_id
  OR old.external_uri IS NOT new.external_uri OR old.kind IS NOT new.kind OR old.connection_id IS NOT new.connection_id
BEGIN
  UPDATE source SET search_revision = old.search_revision + 1 WHERE id = new.id;
  UPDATE source_search_document SET status = 'stale' WHERE source_id = new.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_connection_deleted BEFORE DELETE ON provider_connection BEGIN
  UPDATE source SET status = 'archived' WHERE connection_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER source_knowledge_sync_deleted BEFORE DELETE ON source_knowledge_sync BEGIN
  UPDATE source SET status = 'archived' WHERE json_extract(metadata, '$.syncId') = old.id;
END;
