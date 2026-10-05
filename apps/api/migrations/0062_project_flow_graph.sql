ALTER TABLE `conversation_run` RENAME COLUMN "stage_id" TO "node_id";--> statement-breakpoint
ALTER TABLE `project_task` RENAME COLUMN "stage_id" TO "node_id";--> statement-breakpoint
CREATE TABLE `project_flow_event` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`node_id` text NOT NULL,
	`epoch` integer NOT NULL,
	`step` integer NOT NULL,
	`kind` text NOT NULL,
	`wait_id` text,
	`detail` text,
	`actor_user_id` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wait_id`) REFERENCES `project_flow_wait`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_flow_event_task_sequence_idx` ON `project_flow_event` (`task_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `project_flow_wait` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`node_id` text NOT NULL,
	`epoch` integer NOT NULL,
	`step` integer NOT NULL,
	`attempt` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`assigned_user_id` integer,
	`due_at` text,
	`execution_id` text,
	`payload` text NOT NULL,
	`response` text,
	`response_digest` text,
	`error` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "project_flow_wait_revision_check" CHECK("project_flow_wait"."revision" > 0 AND "project_flow_wait"."epoch" > 0 AND "project_flow_wait"."step" > 0 AND "project_flow_wait"."attempt" > 0),
	CONSTRAINT "project_flow_wait_payload_check" CHECK(json_valid("project_flow_wait"."payload") AND length(CAST("project_flow_wait"."payload" AS BLOB)) <= 262144)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_flow_wait_identity_idx` ON `project_flow_wait` (`task_id`,`epoch`,`node_id`,`step`,`attempt`,`name`);--> statement-breakpoint
CREATE INDEX `project_flow_wait_due_idx` ON `project_flow_wait` (`status`,`kind`,`due_at`);--> statement-breakpoint
CREATE INDEX `project_flow_wait_task_idx` ON `project_flow_wait` (`task_id`,`status`);--> statement-breakpoint
CREATE TABLE `project_record_trigger` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`table_id` text NOT NULL,
	`trigger_key` text NOT NULL,
	`runner_user_id` integer NOT NULL,
	`configuration` text NOT NULL,
	`flow_snapshot` text NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`error` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`table_id`) REFERENCES `output`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`runner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_record_trigger_project_key_idx` ON `project_record_trigger` (`project_id`,`trigger_key`);--> statement-breakpoint
CREATE INDEX `project_record_trigger_active_idx` ON `project_record_trigger` (`enabled`,`updated_at`);--> statement-breakpoint
ALTER TABLE `project_task` ADD `flow_execution` text;--> statement-breakpoint
ALTER TABLE `project_task` ADD `flow_revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE __project_flow_transition (scope TEXT NOT NULL, id TEXT NOT NULL, previous TEXT, graph TEXT, PRIMARY KEY(scope, id));
--> statement-breakpoint
INSERT INTO __project_flow_transition (scope, id, previous, graph)
SELECT 'project', id, flow, flow FROM project WHERE flow IS NOT NULL;
--> statement-breakpoint
INSERT INTO __project_flow_transition (scope, id, previous, graph)
SELECT 'task', task.id, COALESCE(task.flow_snapshot, project.flow), COALESCE(task.flow_snapshot, project.flow)
FROM project_task task JOIN project ON project.id = task.project_id;
--> statement-breakpoint
UPDATE __project_flow_transition SET graph = json_object(
  'version', 1, 'entryNodeId', 'legacy-agent-0', 'maxSteps', 256, 'recordTriggers', json('[]'),
  'nodes', json((SELECT json_group_array(json(node)) FROM (
    SELECT CAST(stage.key AS INTEGER) * 2 AS ordering, json_object(
      'id', 'legacy-agent-' || stage.key, 'name', json_extract(stage.value, '$.name'),
      'type', 'agent', 'instructions', json_extract(stage.value, '$.instructions'),
      'teammateId', json_extract(stage.value, '$.teammateId'),
      'skillIds', json(COALESCE(json_extract(stage.value, '$.skillIds'), '[]')),
      'mode', json_extract(stage.value, '$.mode'),
      'requiresApprovalFor', json(COALESCE(json_extract(stage.value, '$.requiresApprovalFor'), '[]')),
      'next', CASE WHEN json_extract(stage.value, '$.advance') = 'on_human_accept' THEN 'legacy-review-' || stage.key
        WHEN CAST(stage.key AS INTEGER) + 1 < json_array_length(previous, '$.stages') THEN 'legacy-agent-' || (CAST(stage.key AS INTEGER) + 1)
        ELSE 'legacy-complete' END) AS node
    FROM json_each(previous, '$.stages') stage
    UNION ALL
    SELECT CAST(stage.key AS INTEGER) * 2 + 1, json_object(
      'id', 'legacy-review-' || stage.key, 'name', 'Review ' || json_extract(stage.value, '$.name'),
      'type', 'human_wait', 'prompt', 'Review the work before continuing.', 'assigneeUserId', NULL, 'fields', json('[]'),
      'onAccepted', CASE WHEN CAST(stage.key AS INTEGER) + 1 < json_array_length(previous, '$.stages')
        THEN 'legacy-agent-' || (CAST(stage.key AS INTEGER) + 1) ELSE 'legacy-complete' END,
      'onRejected', 'legacy-cancelled')
    FROM json_each(previous, '$.stages') stage WHERE json_extract(stage.value, '$.advance') = 'on_human_accept'
    UNION ALL SELECT 10000, json_object('id', 'legacy-complete', 'name', 'Complete', 'type', 'end', 'status', 'done')
    UNION ALL SELECT 10001, json_object('id', 'legacy-cancelled', 'name', 'Rejected', 'type', 'end', 'status', 'cancelled')
      WHERE EXISTS (SELECT 1 FROM json_each(previous, '$.stages') WHERE json_extract(value, '$.advance') = 'on_human_accept')
    ORDER BY ordering
  )))
) WHERE json_type(previous, '$.stages') = 'array';
--> statement-breakpoint
UPDATE __project_flow_transition SET graph = '{"version":1,"entryNodeId":"work","nodes":[{"id":"work","name":"Work","type":"agent","instructions":null,"teammateId":null,"skillIds":[],"mode":null,"requiresApprovalFor":[],"next":"work-review"},{"id":"work-review","name":"Review work","type":"human_wait","prompt":"Review the work before continuing.","assigneeUserId":null,"fields":[],"onAccepted":"complete","onRejected":"cancelled"},{"id":"complete","name":"Complete","type":"end","status":"done"},{"id":"cancelled","name":"Rejected","type":"end","status":"cancelled"}],"maxSteps":256,"recordTriggers":[]}'
WHERE graph IS NULL;
--> statement-breakpoint
UPDATE conversation_run SET node_id = COALESCE((SELECT 'legacy-agent-' || stage.key
  FROM __project_flow_transition migration, json_each(migration.previous, '$.stages') stage
  WHERE migration.scope = 'task' AND migration.id = conversation_run.project_task_id
    AND json_extract(stage.value, '$.id') = conversation_run.node_id),
  (SELECT json_extract(graph, '$.entryNodeId') FROM __project_flow_transition
    WHERE scope = 'task' AND id = conversation_run.project_task_id))
WHERE project_task_id IS NOT NULL;
--> statement-breakpoint
UPDATE project_task SET node_id = COALESCE((SELECT 'legacy-agent-' || stage.key
  FROM __project_flow_transition migration, json_each(migration.previous, '$.stages') stage
  WHERE migration.scope = 'task' AND migration.id = project_task.id
    AND json_extract(stage.value, '$.id') = project_task.node_id),
  (SELECT json_extract(graph, '$.entryNodeId') FROM __project_flow_transition WHERE scope = 'task' AND id = project_task.id)),
  completions = (SELECT json_group_array(json_set(json_remove(completion.value, '$.stageId'),
    '$.nodeId', COALESCE((SELECT 'legacy-agent-' || stage.key
      FROM __project_flow_transition migration, json_each(migration.previous, '$.stages') stage
      WHERE migration.scope = 'task' AND migration.id = project_task.id
        AND json_extract(stage.value, '$.id') = json_extract(completion.value, '$.stageId')),
      (SELECT json_extract(graph, '$.entryNodeId') FROM __project_flow_transition WHERE scope = 'task' AND id = project_task.id)),
    '$.approval.reviewWaitId', NULL)) FROM json_each(COALESCE(completions, '[]')) completion);
--> statement-breakpoint
UPDATE project SET flow = (SELECT graph FROM __project_flow_transition WHERE scope = 'project' AND id = project.id) WHERE flow IS NOT NULL;
--> statement-breakpoint
UPDATE project_task SET flow_snapshot = (SELECT graph FROM __project_flow_transition WHERE scope = 'task' AND id = project_task.id);
--> statement-breakpoint
UPDATE project_task SET flow_snapshot = json_set(flow_snapshot, '$.nodes', json((SELECT json_group_array(json(node)) FROM (
  SELECT CAST(item.key AS INTEGER) AS ordering, CASE WHEN json_extract(item.value, '$.id') = project_task.node_id
    THEN json_set(item.value, '$.next', 'migration-pending-review') ELSE item.value END AS node
  FROM json_each(project_task.flow_snapshot, '$.nodes') item
  UNION ALL SELECT 10000, json_object('id', 'migration-pending-review', 'name', 'Review pending work',
    'type', 'human_wait', 'prompt', 'Review the work before continuing.', 'assigneeUserId', NULL, 'fields', json('[]'),
    'onAccepted', (SELECT json_extract(value, '$.next') FROM json_each(project_task.flow_snapshot, '$.nodes') WHERE json_extract(value, '$.id') = project_task.node_id),
    'onRejected', 'migration-cancelled')
  UNION ALL SELECT 10001, json_object('id', 'migration-cancelled', 'name', 'Rejected', 'type', 'end', 'status', 'cancelled')
  ORDER BY ordering
)))) WHERE status = 'review' AND NOT EXISTS (
  SELECT 1 FROM json_each(flow_snapshot, '$.nodes') review WHERE json_extract(review.value, '$.type') = 'human_wait'
    AND json_extract(review.value, '$.id') = (SELECT json_extract(agent.value, '$.next') FROM json_each(project_task.flow_snapshot, '$.nodes') agent WHERE json_extract(agent.value, '$.id') = project_task.node_id)
);
--> statement-breakpoint
UPDATE project_task SET node_id = (SELECT json_extract(value, '$.next') FROM json_each(flow_snapshot, '$.nodes') WHERE json_extract(value, '$.id') = project_task.node_id)
WHERE status = 'review';
--> statement-breakpoint
UPDATE project_task SET node_id = (SELECT json_extract(value, '$.id') FROM json_each(flow_snapshot, '$.nodes')
  WHERE json_extract(value, '$.type') = 'end' AND json_extract(value, '$.status') = project_task.status LIMIT 1)
WHERE status IN ('done', 'cancelled');
--> statement-breakpoint
UPDATE project_task SET node_id = COALESCE(node_id, json_extract(flow_snapshot, '$.entryNodeId'));
--> statement-breakpoint
INSERT INTO project_flow_wait (id, task_id, node_id, epoch, step, attempt, name, kind, status, assigned_user_id, execution_id, payload)
SELECT 'flow-migration:' || task.id, task.id, task.node_id, 1, 1, 1, json_extract(node.value, '$.name'),
  CASE WHEN task.status = 'review' THEN 'human' ELSE 'agent' END,
  CASE WHEN task.status != 'review' AND task.dispatch_task_id IS NOT NULL THEN 'dispatched' ELSE 'pending' END,
  CASE WHEN task.status = 'review' THEN COALESCE(task.assignee_user_id, task.created_by_user_id) ELSE NULL END,
  task.dispatch_task_id, CASE WHEN task.status = 'review' THEN json_object('assignedUserId', COALESCE(task.assignee_user_id, task.created_by_user_id)) ELSE '{}' END
FROM project_task task, json_each(task.flow_snapshot, '$.nodes') node
WHERE json_extract(node.value, '$.id') = task.node_id
  AND (task.status IN ('review', 'queued', 'running') OR (task.status = 'blocked' AND task.dispatch_task_id IS NOT NULL));
--> statement-breakpoint
UPDATE project_task SET flow_execution = json_object('epoch', 1, 'nodeId', node_id,
  'steps', CASE WHEN status IN ('done', 'cancelled') OR EXISTS(SELECT 1 FROM project_flow_wait WHERE task_id = project_task.id) THEN 1 ELSE 0 END,
  'iterations', json('{}'), 'values', json('{}'), 'waitId', (SELECT id FROM project_flow_wait WHERE task_id = project_task.id)),
  flow_revision = 1,
  runner_identity_user_id = CASE WHEN status = 'review' THEN COALESCE(runner_identity_user_id, created_by_user_id) ELSE runner_identity_user_id END,
  completions = (SELECT json_group_array(json_set(completion.value, '$.approval.reviewWaitId',
    CASE WHEN json_extract(completion.value, '$.approval.status') = 'pending' AND status = 'review' THEN 'flow-migration:' || project_task.id ELSE NULL END))
    FROM json_each(COALESCE(completions, '[]')) completion);
--> statement-breakpoint
INSERT INTO project_flow_event (task_id, node_id, epoch, step, kind, wait_id, detail)
SELECT id, node_id, 1, json_extract(flow_execution, '$.steps'),
  CASE WHEN status = 'done' THEN 'completed' WHEN status = 'cancelled' THEN 'cancelled'
    WHEN json_extract(flow_execution, '$.waitId') IS NOT NULL THEN 'waiting' ELSE 'entered' END,
  json_extract(flow_execution, '$.waitId'), 'Migrated the existing task checkpoint to a graph.'
FROM project_task;
--> statement-breakpoint
DROP TABLE __project_flow_transition;
--> statement-breakpoint
CREATE TRIGGER project_task_flow_snapshot_immutable BEFORE UPDATE OF flow_snapshot ON project_task
WHEN json_extract(OLD.flow_execution, '$.steps') > 0 AND NEW.flow_snapshot IS NOT OLD.flow_snapshot
BEGIN SELECT RAISE(ABORT, 'project_task_flow_snapshot_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_flow_event_immutable BEFORE UPDATE ON project_flow_event
BEGIN SELECT RAISE(ABORT, 'project_flow_event_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_flow_wait_identity_immutable BEFORE UPDATE ON project_flow_wait
WHEN NEW.task_id IS NOT OLD.task_id OR NEW.node_id IS NOT OLD.node_id OR NEW.epoch IS NOT OLD.epoch
  OR NEW.step IS NOT OLD.step OR NEW.name IS NOT OLD.name OR NEW.kind IS NOT OLD.kind OR NEW.payload IS NOT OLD.payload
  OR NEW.due_at IS NOT OLD.due_at OR NEW.created_at IS NOT OLD.created_at
  OR (OLD.status IN ('completed', 'failed', 'cancelled') AND
    (NEW.status IS NOT OLD.status OR NEW.response IS NOT OLD.response OR NEW.response_digest IS NOT OLD.response_digest))
BEGIN SELECT RAISE(ABORT, 'project_flow_wait_identity_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER native_record_change_immutable BEFORE UPDATE ON native_record_change
BEGIN SELECT RAISE(ABORT, 'native_record_change_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER project_task_flow_state_insert BEFORE INSERT ON project_task
WHEN COALESCE(CASE WHEN json_valid(NEW.flow_snapshot) AND json_valid(NEW.flow_execution) THEN
  json_extract(NEW.flow_snapshot, '$.version') = 1 AND json_type(NEW.flow_snapshot, '$.nodes') = 'array'
  AND NEW.node_id = json_extract(NEW.flow_execution, '$.nodeId')
  AND json_type(NEW.flow_execution, '$.steps') = 'integer' AND json_extract(NEW.flow_execution, '$.steps') BETWEEN 0 AND 1000
  AND json_type(NEW.flow_execution, '$.epoch') = 'integer' AND json_extract(NEW.flow_execution, '$.epoch') > 0
  ELSE 0 END, 0) = 0
BEGIN SELECT RAISE(ABORT, 'project_task_flow_state_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER project_task_flow_state_update BEFORE UPDATE OF flow_snapshot, flow_execution, node_id ON project_task
WHEN COALESCE(CASE WHEN json_valid(NEW.flow_snapshot) AND json_valid(NEW.flow_execution) THEN
  json_extract(NEW.flow_snapshot, '$.version') = 1 AND json_type(NEW.flow_snapshot, '$.nodes') = 'array'
  AND NEW.node_id = json_extract(NEW.flow_execution, '$.nodeId')
  AND json_type(NEW.flow_execution, '$.steps') = 'integer' AND json_extract(NEW.flow_execution, '$.steps') BETWEEN 0 AND 1000
  AND json_type(NEW.flow_execution, '$.epoch') = 'integer' AND json_extract(NEW.flow_execution, '$.epoch') > 0
  ELSE 0 END, 0) = 0
BEGIN SELECT RAISE(ABORT, 'project_task_flow_state_invalid'); END;
