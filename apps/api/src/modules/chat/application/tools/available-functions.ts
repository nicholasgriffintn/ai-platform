import type { ToolDefinitionLike } from "@ngriffin_uk/polychat-ai-providers";
import { resolveRequestUser } from "@ngriffin_uk/polychat-ai-providers";
import {
  FINISH_TOOL_NAME,
  PermissionChecker,
  teammateControlToolDeclarations,
} from "@ngriffin_uk/polychat-library-tools";
import { isAgentExecutionMode } from "@ngriffin_uk/polychat-schemas";
import { getCatalogueToolName } from "@ngriffin_uk/polychat-utility-server/tool-names";

import { filterToolsForConversationType } from "~/modules/chat/application/policy/meta-assistant";
import { resolveEnabledFunctionToolNames } from "~/modules/functions/application/availability";
import { listFunctionToolDefinitions } from "~/modules/functions/application/definitions";
import type { ChatCompletionParameters } from "~/types";

const permissionChecker = new PermissionChecker();

export type AvailableFunctionsSource = Pick<
  ChatCompletionParameters,
  | "enabled_tools"
  | "options"
  | "tools"
  | "context"
  | "connectedConnectorProviders"
  | "mode"
  | "tool_policy_mode"
  | "conversation_type"
  | "require_approval_for"
  | "denied_tools"
  | "enforce_mode_tool_policy"
>;

export interface ResolvedAvailableFunctions {
  available_functions: ToolDefinitionLike[];
  deferred_functions: ToolDefinitionLike[];
  tools: Record<string, any>[] | undefined;
}

export function resolveAvailableFunctions(
  params: AvailableFunctionsSource,
): ResolvedAvailableFunctions {
  const user = resolveRequestUser(params);
  const toolPolicyMode = params.tool_policy_mode ?? params.mode;
  const enabledTools = resolveEnabledFunctionToolNames(params.enabled_tools, user);
  const catalogueTools = listFunctionToolDefinitions({
    connectedConnectorProviders: params.connectedConnectorProviders,
    selectedConnectorProvider: params.options?.connector?.provider,
  });
  const availableTools = filterToolsForConversationType(catalogueTools, params.conversation_type);
  const allowed = availableTools
    .filter((func) => enabledTools.has(func.name))
    .filter(
      (func) =>
        permissionChecker.checkToolAccess({
          toolName: func.name,
          mode: toolPolicyMode,
          user,
          toolType: func.type,
          toolPermissions: func.permissions,
          requireApprovalFor: params.require_approval_for,
          deniedTools: params.denied_tools,
          enforceModePolicy: params.enforce_mode_tool_policy,
        }).allowed,
    );
  const available_functions: ToolDefinitionLike[] = [...allowed];

  if (isAgentExecutionMode(params.mode)) {
    const controlTools =
      params.conversation_type === "task"
        ? teammateControlToolDeclarations.filter((tool) => tool.function.name !== FINISH_TOOL_NAME)
        : teammateControlToolDeclarations;

    available_functions.push(...controlTools);
  }

  const catalogueToolNames = new Set(catalogueTools.map((tool) => tool.name));
  const tools = params.tools?.filter((tool) => {
    const name = getCatalogueToolName(tool);

    return !name || !catalogueToolNames.has(name);
  });

  return {
    available_functions,
    deferred_functions: catalogueTools,
    tools,
  };
}

export function withAvailableFunctions<T extends AvailableFunctionsSource>(
  params: T,
): T & ResolvedAvailableFunctions {
  return { ...params, ...resolveAvailableFunctions(params) };
}
