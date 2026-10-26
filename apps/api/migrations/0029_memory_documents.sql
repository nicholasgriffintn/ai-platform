DROP TRIGGER IF EXISTS `source_search_revision_delete`;--> statement-breakpoint
CREATE TRIGGER source_search_revision_delete AFTER DELETE ON resource WHEN old.resource_type IN ('source', 'output', 'memory') BEGIN
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND resource_type = old.resource_type AND source_id = old.id;
END;--> statement-breakpoint
CREATE TRIGGER memory_search_revision_update
AFTER UPDATE OF content, title, metadata, scope_type, scope_id, deleted_at ON resource
WHEN old.resource_type = 'memory' AND (old.content IS NOT new.content OR old.title IS NOT new.title
  OR old.metadata IS NOT new.metadata OR old.scope_type IS NOT new.scope_type OR old.scope_id IS NOT new.scope_id
  OR old.deleted_at IS NOT new.deleted_at)
BEGIN
  UPDATE resource SET search_revision = old.search_revision + 1 WHERE resource_type = 'memory' AND id = new.id;
  UPDATE search_document SET status = 'stale' WHERE document_type = 'source' AND resource_type = 'memory' AND source_id = new.id;
END;--> statement-breakpoint
UPDATE scoped_configuration SET payload = json_set(payload, '$.memory_provider', 'documents')
  WHERE kind = 'preferences' AND json_extract(payload, '$.memory_provider') IN ('built-in', 'builtin', 'vectorize');--> statement-breakpoint
DELETE FROM resource WHERE resource_type = 'source' AND kind = 'memory'
  AND COALESCE(json_extract(metadata, '$.memory_provider'), provider, 'built-in') NOT IN ('hindsight', 'honcho');
