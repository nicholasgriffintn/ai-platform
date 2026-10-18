import { findToolRule, isOwnerStartedTrigger } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ConversationManager } from "~/modules/conversations/application/manager";
import {
  hasStandingApproval,
  resolveToolCallDestination,
  resolveToolCallEffectClass,
} from "~/modules/tools/application/effects";
import { PermissionChecker } from "~/modules/tools/application/permissions";
import { filterToolsForPolyTurn } from "~/modules/tools/application/poly-turn-policy";
import type { IFunctionResponse, IRequest } from "~/types";

import { resolveFunctionTool, validateFunctionArgs } from "./catalogue";
import { applyFunctionRequestContext } from "./request-context";

const permissionChecker = new PermissionChecker();

export const handleFunctions = async ({
  completion_id,
  app_url,
  functionName,
  tool_call_id,
  args,
  request,
  conversationManager,
  emitToolResult,
}: {
  completion_id: string;
  app_url: string | undefined;
  functionName: string;
  tool_call_id?: string;
  args: unknown;
  request: IRequest;
  conversationManager?: ConversationManager;
  emitToolResult?: (response: IFunctionResponse) => Promise<void> | void;
}): Promise<IFunctionResponse> => {
  if (
    filterToolsForPolyTurn([{ name: functionName }], {
      conversationType: request.request?.conversation_type,
      trigger: request.request?.trigger,
    }).length === 0
  ) {
    throw new AssistantError(
      `Tool "${functionName}" is not allowed in this conversation`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const requestMode = request.request?.tool_policy_mode || request.request?.mode || request.mode;

  const foundFunction = resolveFunctionTool(functionName);
  const permissionResult = permissionChecker.checkRequestToolAccess({
    toolName: functionName,
    mode: requestMode,
    user: request.user,
    toolType: foundFunction.type,
    toolPermissions: foundFunction.permissions,
    approvedTools: request.request?.approved_tools,
    requireApprovalFor: request.request?.require_approval_for,
    deniedTools: request.request?.denied_tools,
    enforceModePolicy: request.request?.enforce_mode_tool_policy,
    effectClass: resolveToolCallEffectClass({
      toolName: functionName,
      effects: foundFunction.effects,
      rawArguments: args,
    }),
    autonomyLevel: request.request?.autonomy_level,
    standingApproval: hasStandingApproval({
      approvals: request.request?.standing_approvals,
      toolName: functionName,
      destination: resolveToolCallDestination({
        effects: foundFunction.effects,
        rawArguments: args,
      }),
      now: Date.now(),
    }),
    toolRule: findToolRule(request.request?.tool_rules, functionName),
    ownerStartedRun: isOwnerStartedTrigger(request.request?.trigger),
  });

  if (!permissionResult.allowed) {
    const isAuthenticationError =
      (foundFunction.type === "premium" &&
        permissionResult.reason === "This tool requires a premium subscription") ||
      permissionResult.reason === "This tool requires a signed-in user";

    throw new AssistantError(
      permissionResult.reason || `Tool "${functionName}" is not allowed in this mode`,
      isAuthenticationError ? ErrorType.AUTHENTICATION_ERROR : ErrorType.AUTHORISATION_ERROR,
      isAuthenticationError ? 401 : 403,
      {
        toolName: functionName,
        mode: permissionResult.mode,
      },
    );
  }

  if (permissionResult.requiresApproval && !permissionResult.approved) {
    throw new AssistantError(
      permissionResult.reason || `Tool "${functionName}" requires approval before execution`,
      ErrorType.AUTHORISATION_ERROR,
      403,
      {
        toolName: functionName,
        mode: permissionResult.mode,
        requiresApproval: true,
      },
    );
  }

  const contextualArgs = applyFunctionRequestContext({
    args,
    functionName,
    requestOptions: request.request?.options,
  });
  const validatedArgs = validateFunctionArgs(foundFunction, contextualArgs);
  const response = await foundFunction.execute(validatedArgs, {
    completionId: completion_id,
    toolCallId: tool_call_id,
    env: request.env,
    user: request.user,
    request,
    appUrl: app_url,
    conversationManager,
    emitToolResult,
  });

  return response;
};
