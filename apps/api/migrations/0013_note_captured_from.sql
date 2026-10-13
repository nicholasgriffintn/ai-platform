UPDATE `resource`
SET `content` = json_set(
  json_remove(`content`, '$.metadata.tabSource'),
  '$.metadata.capturedFrom',
  json_extract(`content`, '$.metadata.tabSource')
)
WHERE `capability_id` = 'notes'
  AND json_type(`content`, '$.metadata.tabSource') = 'object';
