import {
	projectFileSearchConfigurationSchema,
	projectMcpConfigurationSchema,
	type ChatHostedToolSettings,
	type ProjectToolDefinition,
} from "@assistant/schemas";

import type { ProjectCapabilityRow } from "~/repositories/WorkspaceRepository";
import { PROJECT_TOOL_DEFINITIONS } from "~/services/dynamic-apps/config";
import { listFunctionTools } from "~/services/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ResolvedProjectTools {
	enabledTools: string[];
	toolOptions?: ChatHostedToolSettings;
}

function parseStoredConfiguration(configuration: ProjectCapabilityRow["configuration"]): unknown {
	if (typeof configuration !== "string") return configuration ?? {};
	try {
		return JSON.parse(configuration);
	} catch {
		return {};
	}
}

function getToolDefinition(toolId: string): ProjectToolDefinition | undefined {
	return PROJECT_TOOL_DEFINITIONS.find((tool) => tool.id === toolId);
}

function getCallableToolIds(): Set<string> {
	return new Set(listFunctionTools().map((tool) => tool.name));
}

export function validateProjectToolConfiguration(
	toolId: string,
	configuration: Record<string, unknown>,
): Record<string, unknown> {
	const definition = getToolDefinition(toolId);
	if (!definition) {
		if (getCallableToolIds().has(toolId)) return {};
		throw new AssistantError("Unknown project tool", ErrorType.PARAMS_ERROR, 400);
	}
	if (!definition.requiresConfiguration) return {};

	const result =
		definition.configurationKind === "file_search"
			? projectFileSearchConfigurationSchema.safeParse(configuration)
			: definition.configurationKind === "mcp"
				? projectMcpConfigurationSchema.safeParse(configuration)
				: null;
	if (!result?.success) {
		throw new AssistantError(
			`${definition.label} configuration is incomplete`,
			ErrorType.PARAMS_ERROR,
			400,
		);
	}

	return result.data;
}

export function resolveProjectTools(capabilities: ProjectCapabilityRow[]): ResolvedProjectTools {
	const callableToolIds = getCallableToolIds();
	const configuredToolRows = new Map(
		capabilities
			.filter((capability) => capability.kind === "tool")
			.map((capability) => [capability.capability_id, capability]),
	);
	const enabledTools = capabilities
		.filter(
			(capability) => capability.kind === "tool" && callableToolIds.has(capability.capability_id),
		)
		.map((capability) => capability.capability_id);
	const toolOptions: ChatHostedToolSettings = {};

	for (const definition of PROJECT_TOOL_DEFINITIONS) {
		if (!definition.requiresConfiguration) {
			enabledTools.push(definition.id);
			continue;
		}

		const row = configuredToolRows.get(definition.id);
		if (!row) continue;
		const configuration = parseStoredConfiguration(row.configuration);

		if (definition.configurationKind === "file_search") {
			const parsed = projectFileSearchConfigurationSchema.safeParse(configuration);
			if (!parsed.success) continue;
			enabledTools.push(definition.id);
			toolOptions.file_search = { vector_store_ids: parsed.data.vectorStoreIds };
		}

		if (definition.configurationKind === "mcp") {
			const parsed = projectMcpConfigurationSchema.safeParse(configuration);
			if (!parsed.success) continue;
			enabledTools.push(definition.id);
			toolOptions.mcp_servers = parsed.data.servers.map((server) => ({
				require_approval: "always",
				server_label: server.label,
				server_url: new URL(server.url).toString(),
			}));
		}
	}

	return {
		enabledTools: [...new Set(enabledTools)],
		...(Object.keys(toolOptions).length > 0 ? { toolOptions } : {}),
	};
}
