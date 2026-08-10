import {
	projectFileSearchConfigurationSchema,
	projectMcpConfigurationSchema,
	type ProjectFileSearchConfiguration,
	type ProjectMcpConfiguration,
	type ProjectToolDefinition,
} from "@assistant/schemas";

export type ProjectToolConfiguration = ProjectFileSearchConfiguration | ProjectMcpConfiguration;

export function parseProjectToolConfiguration(
	tool: ProjectToolDefinition,
	configuration: unknown,
): ProjectToolConfiguration | null {
	if (tool.configurationKind === "file_search") {
		const parsed = projectFileSearchConfigurationSchema.safeParse(configuration);
		return parsed.success ? parsed.data : null;
	}
	if (tool.configurationKind === "mcp") {
		const parsed = projectMcpConfigurationSchema.safeParse(configuration);
		return parsed.success ? parsed.data : null;
	}
	return null;
}
