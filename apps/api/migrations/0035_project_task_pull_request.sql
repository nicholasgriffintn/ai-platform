CREATE INDEX IF NOT EXISTS project_task_pull_request_idx
  ON project_task (
    json_extract(details, '$.pullRequest.repository'),
    json_extract(details, '$.pullRequest.number')
  );
