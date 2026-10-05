ALTER TABLE `teammates` ADD `retired_mcp_servers` text;
--> statement-breakpoint
UPDATE teammates SET retired_mcp_servers = servers, servers = '[]'
WHERE servers IS NOT NULL AND servers != '[]';
--> statement-breakpoint
UPDATE capability_configuration SET capability_id = 'retired_hosted_mcp_' || id
WHERE capability_kind = 'tool' AND capability_id = 'mcp';
