UPDATE conversation
SET type = 'task'
WHERE id IN (
  SELECT conversation_id
  FROM project_task
  WHERE conversation_id IS NOT NULL
)
OR id IN (
  SELECT json_extract(completion.value, '$.conversationId')
  FROM project_task, json_each(COALESCE(project_task.completions, '[]')) AS completion
  WHERE json_extract(completion.value, '$.conversationId') IS NOT NULL
)
OR id IN (
  SELECT 'recipe_' || id
  FROM tasks
  WHERE task_type = 'recipe_execution'
);
