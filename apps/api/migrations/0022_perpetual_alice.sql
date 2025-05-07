ALTER TABLE `agents` ADD `model` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `temperature` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `max_steps` integer;--> statement-breakpoint
ALTER TABLE `agents` ADD `system_prompt` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `few_shot_examples` text;