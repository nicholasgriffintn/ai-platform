UPDATE `scoped_configuration`
SET `payload` = json_set(`payload`, '$.speech_provider', json('null'), '$.speech_model', json('null'))
WHERE `kind` = 'preferences' AND json_extract(`payload`, '$.speech_provider') = 'melotts';
--> statement-breakpoint
UPDATE `scoped_configuration`
SET `payload` = json_set(
  `payload`,
  '$.speech_voice', json_extract(`payload`, '$.speech_model'),
  '$.speech_model', json('null')
)
WHERE `kind` = 'preferences'
  AND json_extract(`payload`, '$.speech_provider') IN ('mistral', 'polly')
  AND json_extract(`payload`, '$.speech_model') IS NOT NULL;
--> statement-breakpoint
UPDATE `scoped_configuration`
SET `payload` = json_set(`payload`, '$.speech_model', json('null'))
WHERE `kind` = 'preferences'
  AND json_extract(`payload`, '$.speech_provider') = 'cartesia'
  AND json_extract(`payload`, '$.speech_model') <> 'sonic-3.6';
