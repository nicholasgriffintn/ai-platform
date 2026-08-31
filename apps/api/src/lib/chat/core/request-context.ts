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
      conversation_type: chatOptions.conversation_type,
      input,
      model,
      provider,
      mode,
      tool_policy_mode: chatOptions.tool_policy_mode,
      date: new Date().toISOString().slice(0, 10),
      approved_tools: chatOptions.approved_tools ?? [],
      enabled_tools: chatOptions.enabled_tools ?? [],
      tool_permissions_map: buildToolPermissionsMap(chatOptions.tools),
      require_approval_for: chatOptions.require_approval_for,
      options: chatOptions.options || {},
      enforce_mode_tool_policy: chatOptions.enforce_mode_tool_policy,
    },
    app_url: chatOptions.app_url,
    user,
    context: chatOptions.context,
    memoryScope,
  };
}
