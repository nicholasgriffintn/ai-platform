ALTER TABLE `workspace` ADD `system_models` text;
--> statement-breakpoint
UPDATE `scoped_configuration`
SET `payload` = json_set(
  `payload`,
  '$.system_models.transcription',
  json_array(json_object(
    'model', json_extract(`payload`, '$.transcription_model'),
    'provider', CASE json_extract(`payload`, '$.transcription_provider')
      WHEN 'workers' THEN 'workers-ai'
      ELSE json_extract(`payload`, '$.transcription_provider')
    END
  ))
)
WHERE `kind` = 'preferences'
  AND json_extract(`payload`, '$.transcription_model') IS NOT NULL
  AND json_extract(`payload`, '$.transcription_provider') IS NOT NULL
  AND json_extract(`payload`, '$.system_models.transcription') IS NULL
  AND NOT (
    json_extract(`payload`, '$.transcription_provider') = 'workers'
    AND json_extract(`payload`, '$.transcription_model') = 'whisper'
  );
--> statement-breakpoint
UPDATE `scoped_configuration`
SET `payload` = json_remove(`payload`, '$.transcription_provider', '$.transcription_model')
WHERE `kind` = 'preferences';
--> statement-breakpoint
UPDATE `scoped_configuration`
SET `payload` = json_set(
  `payload`,
  '$.system_models.speech',
  json_array(json_object(
    'model', json_extract(`payload`, '$.speech_model'),
    'provider', json_extract(`payload`, '$.speech_provider')
  ))
)
WHERE `kind` = 'preferences'
  AND json_extract(`payload`, '$.speech_model') IS NOT NULL
  AND json_extract(`payload`, '$.speech_provider') IS NOT NULL
  AND json_extract(`payload`, '$.system_models.speech') IS NULL;
--> statement-breakpoint
UPDATE `scoped_configuration`
SET `payload` = json_remove(`payload`, '$.speech_provider', '$.speech_model')
WHERE `kind` = 'preferences';
--> statement-breakpoint
UPDATE `scoped_configuration`
SET `payload` = json_set(
  `payload`,
  '$.system_models.guardrails',
  json_array(CASE json_extract(`payload`, '$.guardrails_provider')
    WHEN 'typesafe' THEN json_object('model', 'jev-latest', 'provider', 'typesafe')
    ELSE json_object('model', 'mistral-moderation-latest', 'provider', 'mistral')
  END)
)
WHERE `kind` = 'preferences'
  AND json_extract(`payload`, '$.guardrails_provider') IN ('typesafe', 'mistral')
  AND json_extract(`payload`, '$.system_models.guardrails') IS NULL;
--> statement-breakpoint
UPDATE `scoped_configuration`
SET `payload` = json_set(`payload`, '$.guardrails_provider', 'model')
WHERE `kind` = 'preferences'
  AND json_extract(`payload`, '$.guardrails_provider') IN ('typesafe', 'mistral', 'llamaguard');
