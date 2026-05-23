import type { CoreChatOptions, IRequest, ChatMode } from "~/types";

interface ToolDefinition {
	name?: unknown;
	function?: {
		name?: unknown;
	};
	permissions?: unknown;
}

export function buildToolPermissionsMap(tools?: ToolDefinition[]): Record<string, string[]> {
	if (!tools?.length) return {};

	const permissionsByTool: Record<string, string[]> = {};
	for (const tool of tools) {
		const name =
			typeof tool.name === "string"
				? tool.name
				: typeof tool.function?.name === "string"
					? tool.function.name
					: undefined;
		const permissions = tool.permissions;
		if (name && Array.isArray(permissions) && permissions.length > 0) {
			const toolPermissions = permissions.filter(
				(permission): permission is string => typeof permission === "string",
			);
			if (toolPermissions.length > 0) {
				permissionsByTool[name] = toolPermissions;
			}
		}
	}
	return permissionsByTool;
}

export function buildToolRequestContext(params: {
	chatOptions: CoreChatOptions;
	input: string;
	mode: ChatMode;
	model: string;
	provider: string;
}): IRequest {
	const { chatOptions, input, mode, model, provider } = params;

	return {
		env: chatOptions.env,
		mode,
		request: {
			completion_id: chatOptions.completion_id!,
			input,
			model,
			provider,
			mode,
			date: new Date().toISOString().split("T")[0]!,
			approved_tools: chatOptions.approved_tools ?? [],
			tool_permissions_map: buildToolPermissionsMap(chatOptions.tools),
			options: chatOptions.options || {},
			current_agent_id: chatOptions.current_agent_id,
			delegation_stack: chatOptions.delegation_stack,
			max_delegation_depth: chatOptions.max_delegation_depth,
		},
		app_url: chatOptions.app_url,
		user: chatOptions.user?.id ? chatOptions.user : undefined,
		context: chatOptions.context,
	};
}
