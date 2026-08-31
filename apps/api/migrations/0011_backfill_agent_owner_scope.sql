UPDATE `agents`
SET `owner_scope_type` = 'user',
    `owner_scope_id` = CAST(`user_id` AS TEXT)
WHERE `owner_scope_id` = '' OR `owner_scope_id` IS NULL;
