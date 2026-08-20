import type { CoreChatOptions, IRequest, ChatMode, MemoryScope } from "~/types";
import { resolveRequestUser } from "~/utils/requestUser";
import { getToolDefinitionName, type ToolDefinitionLike } from "~/utils/toolNames";

interface ToolDefinition extends ToolDefinitionLike {
  permissions?: unknown;
}

export function buildToolPermissionsMap(tools?: ToolDefinition[]): Record<string, string[]> {
  if (!tools?.length) {
    return {};
  }

  const permissionsByTool: Record<string, string[]> = {};

  for (const tool of tools) {
    const name = getToolDefinitionName(tool);
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
  memoryScope: MemoryScope;
}): IRequest {
  const { chatOptions, input, mode, model, provider, memoryScope } = params;
  const user = resolveRequestUser(chatOptions);

  return {
    env: chatOptions.env,
    mode,
    request: {
      completion_id: chatOptions.completion_id,
      input,
      model,
      provider,
      mode,
      date: new Date().toISOString().slice(0, 10),
      approved_tools: chatOptions.approved_tools ?? [],
      enabled_tools: chatOptions.enabled_tools ?? [],
      tool_permissions_map: buildToolPermissionsMap(chatOptions.tools),
      options: chatOptions.options || {},
      current_agent_id: chatOptions.current_agent_id,
      delegation_stack: chatOptions.delegation_stack,
      max_delegation_depth: chatOptions.max_delegation_depth,
    },
    app_url: chatOptions.app_url,
    user,
    context: chatOptions.context,
    memoryScope,
    deferredTools: chatOptions.deferred_tools,
  };
}
