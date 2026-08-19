import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import type { ConversationManager } from "~/lib/conversationManager";
import { PermissionChecker, resolveToolPermissions } from "~/lib/permissions/PermissionChecker";
import { ToolRegistry } from "~/lib/tools/ToolRegistry";
import type { IFunctionResponse, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

import type { ApiToolDefinition } from "../../types/functions";
import { analyse_hacker_news } from "./analyse_hacker_news";
import { call_api } from "./api_call";
import { apply_edit_completion } from "./apply_edit";
import { create_note } from "./create_note";
import { discover_capabilities } from "./discover_capabilities";
import { retry_with_backoff, fallback } from "./error_recovery";
import { extract_content } from "./extract_content";
import { fill_in_middle_completion } from "./fill_in_middle";
import { get_note } from "./get_note";
import { complete_goal, set_goal } from "./goal";
import { request_approval, ask_user } from "./human_in_the_loop";
import { create_image } from "./image";
import { load_skill } from "./load_skill";
import { handleMCPTool } from "./mcp";
import { search_memories, store_memory } from "./memory";
import { create_music } from "./music";
import { next_edit_completion } from "./next_edit";
import { extract_text_from_document } from "./ocr";
import { run_pashi_tools, search_pashi_tools } from "./pashi";
import { prompt_coach } from "./prompt_coach";
import { create_qr_code } from "./qr";
import { add_reasoning_step } from "./reasoning";
import { configure_recipe } from "./recipes/configure_recipe";
import { get_recipe } from "./recipes/get_recipe";
import { trigger_recipe } from "./recipes/trigger_recipe";
import {
  createUseRecipeConnectorInputSchema,
  use_recipe_connector,
} from "./recipes/use_recipe_connector";
import { applyFunctionRequestContext } from "./request-context";
import { research } from "./research";
import {
  run_bug_fix,
  run_code_review,
  run_documentation,
  run_feature_implementation,
  run_migration,
  run_refactoring,
  run_test_suite,
} from "./sandbox";
import { capture_screenshot } from "./screenshot";
import { create_speech } from "./speech";
import { delegateToTeamMember, delegateToTeamMemberByRole, getTeamMembers } from "./teamDelegation";
import { tutor } from "./tutor";
import { v0_code_generation } from "./v0_code_generation";
import { create_video } from "./video";
import { get_weather } from "./weather";
import { web_search } from "./web_search";
import { compose_functions, if_then_else, parallel_execute } from "./workflow";

const logger = getLogger({ prefix: "services/functions" });
const FUNCTIONS_TOOL_CATEGORY = "functions";
const permissionChecker = new PermissionChecker();

const functionDefinitions: ApiToolDefinition[] = [
  get_weather,
  create_video,
  create_music,
  create_image,
  fill_in_middle_completion,
  next_edit_completion,
  apply_edit_completion,
  web_search,
  create_qr_code,
  search_pashi_tools,
  run_pashi_tools,
  call_api,
  research,
  extract_content,
  search_memories,
  store_memory,
  create_note,
  get_note,
  extract_text_from_document,
  use_recipe_connector,
  get_recipe,
  configure_recipe,
  trigger_recipe,
  capture_screenshot,
  create_speech,
  tutor,
  prompt_coach,
  add_reasoning_step,
  analyse_hacker_news,
  v0_code_generation,
  delegateToTeamMember,
  delegateToTeamMemberByRole,
  getTeamMembers,
  discover_capabilities,
  set_goal,
  complete_goal,
  load_skill,
  retry_with_backoff,
  fallback,
  compose_functions,
  if_then_else,
  parallel_execute,
  request_approval,
  ask_user,
  run_feature_implementation,
  run_code_review,
  run_test_suite,
  run_bug_fix,
  run_refactoring,
  run_documentation,
  run_migration,
];

export type RegisteredFunctionTool = ApiToolDefinition;

export const toolRegistry = new ToolRegistry();

for (const fn of functionDefinitions) {
  if (!fn) {
    continue;
  }

  const resolvedPermissions = resolveToolPermissions(fn.name, fn.permissions);

  if (resolvedPermissions.length === 0) {
    throw new AssistantError(
      `Tool "${fn.name}" is missing explicit permissions`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  toolRegistry.register(FUNCTIONS_TOOL_CATEGORY, {
    name: fn.name,
    metadata: {
      type: fn.type,
      costPerCall: fn.costPerCall,
      isDefault: fn.isDefault ?? false,
    },
    create: () => ({
      ...fn,
      permissions: resolvedPermissions,
    }),
  });
}

export const listFunctionTools = (options?: {
  connectedConnectorProviders?: readonly RecipeConnectorProvider[];
  selectedConnectorProvider?: RecipeConnectorProvider;
}): RegisteredFunctionTool[] => {
  const definitions = toolRegistry.listDefinitions(
    FUNCTIONS_TOOL_CATEGORY,
  ) as RegisteredFunctionTool[];

  if (!options?.connectedConnectorProviders && !options?.selectedConnectorProvider) {
    return definitions;
  }

  const connectedConnectorProviders = options.connectedConnectorProviders;
  const connectorProviders = options.selectedConnectorProvider
    ? !connectedConnectorProviders ||
      connectedConnectorProviders.includes(options.selectedConnectorProvider)
      ? [options.selectedConnectorProvider]
      : []
    : [...(connectedConnectorProviders ?? [])];

  return definitions.flatMap((definition) => {
    if (definition.name !== use_recipe_connector.name) {
      return [definition];
    }

    if (connectorProviders.length === 0) {
      return [];
    }

    return [
      {
        ...definition,
        inputSchema: createUseRecipeConnectorInputSchema(connectorProviders),
      },
    ];
  });
};

export const resolveFunctionTool = (functionName: string): RegisteredFunctionTool =>
  toolRegistry.resolve(FUNCTIONS_TOOL_CATEGORY, functionName) as RegisteredFunctionTool;

export const validateFunctionArgs = (toolDefinition: RegisteredFunctionTool, args: unknown) => {
  const validation = toolDefinition.inputSchema.safeParse(args);

  if (!validation.success) {
    const validationErrors = validation.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    throw new AssistantError(
      `Invalid arguments for ${toolDefinition.name}`,
      ErrorType.PARAMS_ERROR,
      400,
      { validationErrors },
    );
  }

  return validation.data;
};

export const handleFunctions = async ({
  completion_id,
  app_url,
  functionName,
  args,
  request,
  conversationManager,
  emitToolResult,
}: {
  completion_id: string;
  app_url: string | undefined;
  functionName: string;
  args: unknown;
  request: IRequest;
  conversationManager?: ConversationManager;
  emitToolResult?: (response: IFunctionResponse) => Promise<void> | void;
}): Promise<IFunctionResponse> => {
  const requestMode = request.request?.mode || request.mode;

  if (functionName.startsWith("mcp_")) {
    const mcpPermissionResult = permissionChecker.checkRequestToolAccess({
      toolName: functionName,
      mode: requestMode,
      user: request.user,
      toolType: "normal",
      toolPermissions: ["network"],
      approvedTools: request.request?.approved_tools,
    });

    if (!mcpPermissionResult.allowed) {
      throw new AssistantError(
        mcpPermissionResult.reason || `Tool "${functionName}" is not allowed in this mode`,
        ErrorType.AUTHORISATION_ERROR,
        403,
        {
          toolName: functionName,
          mode: mcpPermissionResult.mode,
        },
      );
    }

    if (mcpPermissionResult.requiresApproval && !mcpPermissionResult.approved) {
      throw new AssistantError(
        mcpPermissionResult.reason || `Tool "${functionName}" requires approval before execution`,
        ErrorType.AUTHORISATION_ERROR,
        403,
        {
          toolName: functionName,
          mode: mcpPermissionResult.mode,
          requiresApproval: true,
        },
      );
    }

    request.request = {
      ...request.request,
      functionName,
    };

    return handleMCPTool(completion_id, args, request, app_url, conversationManager);
  }

  const foundFunction = resolveFunctionTool(functionName);
  const permissionResult = permissionChecker.checkRequestToolAccess({
    toolName: functionName,
    mode: requestMode,
    user: request.user,
    toolType: foundFunction.type,
    toolPermissions: foundFunction.permissions,
    approvedTools: request.request?.approved_tools,
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
  const isProUser = request.user?.plan_id === "pro";
  const isByokTool = foundFunction.type === "byok";
  const functionType = isByokTool
    ? "byok"
    : foundFunction.type === "premium"
      ? "premium"
      : "normal";

  if (conversationManager) {
    try {
      await conversationManager.checkUsageLimits(functionType);
    } catch (error) {
      logger.error("Failed to check usage limits:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  const response = await foundFunction.execute(validatedArgs, {
    completionId: completion_id,
    env: request.env,
    user: request.user,
    request,
    appUrl: app_url,
    conversationManager,
    emitToolResult,
  });

  if (conversationManager) {
    try {
      await conversationManager.incrementFunctionUsage(
        functionType,
        isProUser,
        foundFunction.costPerCall,
      );
    } catch (error) {
      logger.error("Failed to track function usage:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else {
    logger.info("No conversation manager provided, skipping usage tracking");
  }

  return response;
};
