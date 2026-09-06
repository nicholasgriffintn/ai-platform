UPDATE `project_capability` SET `capability_id` = 'featured-recording-processor' WHERE `capability_id` = 'featured-podcast-processor';--> statement-breakpoint
UPDATE `tasks` SET `task_type` = 'recording_transcription_polling' WHERE `task_type` = 'podcast_transcription_polling';
