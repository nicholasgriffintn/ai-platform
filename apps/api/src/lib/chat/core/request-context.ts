import type { RunProvenance } from "@ngriffin_uk/polychat-schemas";

import { withExecutionRunContext } from "~/lib/context/serviceContext";
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
  provenance?: RunProvenance | null;
  model: string;
  provider: string;
  runId?: string;
  runAttempt?: number;
  memoryScope: MemoryScope;
}): IRequest {
  const { chatOptions, input, mode, model, provider, memoryScope, provenance } = params;
  const user = resolveRequestUser(chatOptions);
  const context =
    chatOptions.context && params.runId
      ? withExecutionRunContext(chatOptions.context, params.runId, params.runAttempt)
      : chatOptions.context;

  return {
    env: chatOptions.env,
    mode,
    compute_site: chatOptions.compute_site,
    provenance,
    request: {
      completion_id: chatOptions.completion_id,
      conversation_type: chatOptions.conversation_type,
      meta_assistant: chatOptions.meta_assistant,
      input,
      model,
      provider,
      run_id: params.runId,
      run_attempt: params.runAttempt,
      delegation_context: chatOptions.delegation_context,
      mode,
      compute_site: chatOptions.compute_site,
      tool_policy_mode: chatOptions.tool_policy_mode,
      permission_mode: chatOptions.permission_mode,
      date: new Date().toISOString().slice(0, 10),
      approved_tools: chatOptions.approved_tools ?? [],
      enabled_tools: chatOptions.enabled_tools ?? [],
      tool_permissions_map: buildToolPermissionsMap(chatOptions.tools),
      require_approval_for: chatOptions.require_approval_for,
      denied_tools: chatOptions.denied_tools,
      options: chatOptions.options || {},
      enforce_mode_tool_policy: chatOptions.enforce_mode_tool_policy,
    },
    app_url: chatOptions.app_url,
    user,
    context,
    memoryScope,
  };
}
