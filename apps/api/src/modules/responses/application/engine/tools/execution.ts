import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { findToolRule, isOwnerStartedTrigger } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ConversationManager } from "~/modules/conversations/application/manager";
import { approvalsInARow } from "~/modules/poly/domain/earned-trust";
import { buildMessageParts } from "~/modules/responses/application/engine/messages/parts";
import { createPendingToolApprovalMessage } from "~/modules/responses/application/engine/tools/approval";
import {
  ARTIFACT_MARKUP_TOOL_CORRECTION,
  isArtifactMarkupToolName,
} from "~/modules/responses/application/engine/tools/artifact-markup";
import {
  buildRepeatedToolCallMessage,
  checkToolCallRepeat,
  type ToolCallLedger,
} from "~/modules/responses/application/engine/tools/call-ledger";
import {
  evaluateToolIntentGate,
  requiresToolIntentVerification,
} from "~/modules/responses/application/engine/tools/tool-intent";
import {
  formatToolErrorResponse,
  formatToolResponse,
} from "~/modules/responses/application/engine/tools/tool-responses";
import { resolveEnabledFunctionToolNames } from "~/modules/tools/application/availability";
import {
  resolveFunctionTool,
  resolveToolRepeatLimit,
  validateFunctionArgs,
} from "~/modules/tools/application/catalogue";
import {
  hasStandingApproval,
  isStandingApprovalEligible,
  resolveToolCallEffects,
} from "~/modules/tools/application/effects";
import { handleFunctions } from "~/modules/tools/application/execution";
import { PermissionChecker } from "~/modules/tools/application/permissions";
import { applyFunctionRequestContext } from "~/modules/tools/application/request-context";
import type { IRequest, Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/tools/execution" });
const permissionChecker = new PermissionChecker();
const DETERMINISTIC_TOOL_CALL_ERROR_TYPES = new Set<string>([
  ErrorType.PARAMS_ERROR,
  ErrorType.TOOL_CALL_ERROR,
]);

interface ToolCallError extends Error {
  functionName?: string;
  type?: string;
  status?: number;
  context?: Record<string, unknown>;
}

type ToolResultPersistenceMode = "batch" | "immediate" | "none";

function isUnknownToolError(error: ToolCallError): boolean {
  return error.context?.reason === "unknown_tool";
}

function buildUnknownToolCorrection(functionName: string): string {
  if (isArtifactMarkupToolName(functionName)) {
    return ARTIFACT_MARKUP_TOOL_CORRECTION;
  }

  return `Tool "${functionName}" is not available. Continue using only the tools provided in this request, or answer directly without a tool.`;
}

const RECOVERABLE_TOOL_CALL_ERROR_TYPES = new Set<string>([ErrorType.TOOL_CALL_ERROR]);

function isRecoverableToolCallError(params: {
  errorType: string;
  toolCallId: unknown;
  functionName: string;
}): boolean {
  return (
    RECOVERABLE_TOOL_CALL_ERROR_TYPES.has(params.errorType) &&
    typeof params.toolCallId === "string" &&
    params.toolCallId.length > 0 &&
    params.functionName !== "unknown"
  );
}

function isDeterministicToolCallError(errorType: string): boolean {
  return DETERMINISTIC_TOOL_CALL_ERROR_TYPES.has(errorType);
}

export const handleToolCalls = async (
  completion_id: string,
  modelResponse: any,
  conversationManager: ConversationManager,
  req: IRequest,
  options?: {
    persistResults?: ToolResultPersistenceMode;
    onToolResult?: (message: Message) => Promise<void> | void;
    recoverUnknownToolCalls?: boolean;
    callLedger?: ToolCallLedger;
    onToolExecutionStart?: (tool: { id: string; name: string }) => Promise<void> | void;
    isExecutionAllowed?: () => Promise<boolean> | boolean;
  },
): Promise<Message[]> => {
  const functionResults: Message[] = [];
  const persistResults = options?.persistResults ?? "batch";
  const modelResponseLogId = req.env.AI.aiGatewayLogId;
  const timestamp = Date.now();

  const recordToolResult = async (message: Message) => {
    const messageWithParts = {
      ...message,
      parts: message.parts || buildMessageParts(message),
    };

    functionResults.push(messageWithParts);

    if (persistResults === "immediate") {
      try {
        await conversationManager.add(completion_id, messageWithParts);
      } catch (error) {
        logger.error("Failed to store streamed tool call result:", {
          error,
          completion_id,
          tool_name: messageWithParts.name,
        });
      }
    }

    await options?.onToolResult?.(messageWithParts);
  };

  const toolCalls = modelResponse.tool_calls || [];

  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const mode = req.request?.tool_policy_mode || req.mode || req.request?.mode;
  const toolPermissionsMap = req.request?.tool_permissions_map ?? {};

  for (const toolCall of toolCalls) {
    if (options?.isExecutionAllowed && !(await options.isExecutionAllowed())) {
      break;
    }

    const functionName = toolCall.function?.name || toolCall.name || "unknown";
    let recordToolCallAttempt: (() => void) | undefined;
    let recordDeterministicFailure: (() => void) | undefined;

    logger.info(`Tool call: ${functionName}`);

    try {
      if (!toolCall.id) {
        throw new AssistantError("Missing tool call ID", ErrorType.TOOL_CALL_ERROR);
      }

      if (
        req.request?.enabled_tools &&
        !resolveEnabledFunctionToolNames(req.request.enabled_tools, req.user).has(functionName)
      ) {
        throw new AssistantError(
          `Tool "${functionName}" was not enabled for this run`,
          ErrorType.TOOL_CALL_ERROR,
          400,
          { reason: "unknown_tool" },
        );
      }

      const functionDefinition =
        functionName === "memory" ? null : resolveFunctionTool(functionName);

      const rawToolArguments = toolCall.function?.arguments ?? toolCall.arguments;
      const { effectClass: callEffectClass, destination: callDestination } =
        await resolveToolCallEffects({
          toolName: functionName,
          effects: functionDefinition?.effects,
          rawArguments: rawToolArguments,
          request: req,
        });
      const permissionInput = {
        toolName: functionName,
        mode,
        user: req.user,
        toolType: functionDefinition?.type,
        toolPermissions: functionDefinition?.permissions ?? toolPermissionsMap[functionName],
        approvedTools: req.request?.approved_tools,
        requireApprovalFor: req.request?.require_approval_for,
        deniedTools: req.request?.denied_tools,
        settingsDisabledTools: req.request?.settings_disabled_tools,
        enforceModePolicy: req.request?.enforce_mode_tool_policy,
        effectClass: callEffectClass,
        autonomyLevel: req.request?.autonomy_level,
        standingApproval: hasStandingApproval({
          approvals: req.request?.standing_approvals,
          toolName: functionName,
          destination: callDestination,
          now: Date.now(),
        }),
        toolRule: findToolRule(req.request?.tool_rules, functionName),
        ownerStartedRun: isOwnerStartedTrigger(req.request?.trigger),
      };
      const permissionResult = permissionChecker.checkRequestToolAccess(permissionInput);

      if (!permissionResult.allowed) {
        recordDeterministicFailure?.();
        logger.warn(`Tool "${functionName}" blocked by permission check`, {
          reason: permissionResult.reason,
          mode,
        });
        const blockedError = formatToolErrorResponse(
          functionName,
          permissionResult.reason ??
            `Tool "${functionName}" is not permitted in ${permissionResult.mode} mode`,
          "PERMISSION_DENIED",
        );

        await recordToolResult({
          role: "tool",
          name: functionName,
          content: blockedError.content,
          status: "error",
          data: blockedError.data,
          log_id: modelResponseLogId || "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        });
        continue;
      }

      if (options?.callLedger) {
        const repeat = checkToolCallRepeat(
          options.callLedger,
          functionName,
          toolCall.function?.arguments ?? toolCall.arguments,
          resolveToolRepeatLimit(functionName),
        );

        if (repeat.repeated) {
          logger.warn(`Tool "${functionName}" repeated with identical arguments`, {
            attempts: repeat.attempts,
          });
          const repeatError = formatToolErrorResponse(
            functionName,
            buildRepeatedToolCallMessage(functionName, repeat.attempts),
            "REPEATED_TOOL_CALL",
          );

          await recordToolResult({
            role: "tool",
            name: functionName,
            content: repeatError.content,
            status: "error",
            data: { ...repeatError.data, errorCode: "REPEATED_TOOL_CALL" },
            log_id: modelResponseLogId || "",
            id: generateId(),
            tool_call_id: toolCall.id,
            tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
            timestamp,
            model: req.request?.model || "unknown",
            platform: req.request?.platform || "api",
          });
          continue;
        }

        recordToolCallAttempt = repeat.record;
        recordDeterministicFailure = repeat.recordDeterministicFailure;
      }

      const rawArgs = toolCall.function?.arguments || toolCall.arguments || "{}";
      const functionArgs = safeParseJson(rawArgs);

      if (!functionArgs) {
        logger.error(`Failed to parse arguments for ${functionName}`);
        throw new AssistantError(
          `Invalid arguments for ${functionName}`,
          ErrorType.TOOL_CALL_ERROR,
        );
      }

      if (typeof functionArgs !== "object" || Array.isArray(functionArgs)) {
        throw new AssistantError(
          `Invalid arguments format for ${functionName}: expected object`,
          ErrorType.TOOL_CALL_ERROR,
        );
      }

      const validatedFunctionArgs = functionDefinition
        ? validateFunctionArgs(
            functionDefinition,
            applyFunctionRequestContext({
              args: functionArgs,
              functionName,
              requestOptions: req.request?.options,
            }),
          )
        : functionArgs;

      if (permissionResult.requiresApproval && !permissionResult.approved) {
        recordDeterministicFailure?.();
        logger.warn(`Tool "${functionName}" requires approval but was not pre-approved`, {
          mode,
        });
        const approvalReason =
          permissionResult.reason ??
          `Tool "${functionName}" requires explicit approval before it can run. Ask the user to confirm.`;

        await recordToolResult(
          createPendingToolApprovalMessage({
            toolName: functionName,
            toolCallId: toolCall.id,
            toolCallArguments: toolCall.arguments || toolCall.function?.arguments,
            reason: approvalReason,
            allowRuleLifts: !permissionChecker.checkRequestToolAccess({
              ...permissionInput,
              toolRule: "act",
            }).requiresApproval,
            standingEligible: isStandingApprovalEligible({
              autonomyLevel: req.request?.autonomy_level,
              conversationType: req.request?.conversation_type,
              effectClass: callEffectClass,
              destination: callDestination,
            }),
            approvedInARow: approvalsInARow({
              streaks: req.request?.approval_streaks,
              toolName: functionName,
              destination: callDestination,
              now: Date.now(),
            }),
            logId: modelResponseLogId || "",
            timestamp,
            model: req.request?.model || "unknown",
            platform: req.request?.platform || "api",
          }),
        );
        continue;
      }

      if (
        requiresToolIntentVerification({
          alreadyApproved: permissionResult.approved,
          effectClass: callEffectClass,
        })
      ) {
        const intent = await evaluateToolIntentGate({
          env: req.env,
          user: req.user,
          completionId: completion_id,
          conversationId: req.request?.completion_id,
          request: req.request?.input,
          trigger: req.request?.trigger,
          toolName: functionName,
          permissions: permissionResult.permissions,
          effectClass: callEffectClass,
          destination: callDestination,
          hasEvidenceProjector: Boolean(functionDefinition?.intentEvidence),
          evidence: functionDefinition?.intentEvidence?.(validatedFunctionArgs),
        });

        if (intent.outcome === "require_approval") {
          recordDeterministicFailure?.();
          await recordToolResult(
            createPendingToolApprovalMessage({
              toolName: functionName,
              toolCallId: toolCall.id,
              toolCallArguments: toolCall.arguments || toolCall.function?.arguments,
              reason: intent.reason,
              logId: modelResponseLogId || "",
              timestamp,
              model: req.request?.model || "unknown",
              platform: req.request?.platform || "api",
            }),
          );
          continue;
        }
      }

      if (functionName === "memory") {
        await options?.onToolExecutionStart?.({
          id: toolCall.id,
          name: functionName,
        });

        const memoryArgs = functionArgs;

        const memMessage: Message = {
          role: "tool",
          name: "memory",
          content:
            memoryArgs.type === "store"
              ? `📝 Stored ${memoryArgs.category} memory: ${memoryArgs.text}`
              : "🔍 Created memory snapshot",
          status: "success",
          data: {
            type: memoryArgs.type,
            category: memoryArgs.category,
            text: memoryArgs.text,
          },
          log_id: modelResponseLogId || "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        };

        await recordToolResult(memMessage);
        recordToolCallAttempt?.();
        continue;
      }

      await options?.onToolExecutionStart?.({
        id: toolCall.id,
        name: functionName,
      });

      let result: any;

      try {
        result = await handleFunctions({
          completion_id,
          tool_call_id: toolCall.id,
          app_url: req.app_url,
          functionName,
          args: functionArgs,
          request: req,
          conversationManager,
          emitToolResult: async (toolResult) => {
            const toolResultName = toolResult.name || functionName;
            const formattedResponse = formatToolResponse(
              toolResultName,
              toolResult.content || "",
              toolResult.data,
            );

            await recordToolResult({
              role: toolResult.role || "tool",
              name: toolResultName,
              content: formattedResponse.content,
              status: toolResult.status || "success",
              data: formattedResponse.data,
              log_id: toolResult.log_id || modelResponseLogId || "",
              id: toolResult.id || generateId(),
              tool_call_id: toolCall.id,
              tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
              timestamp: toolResult.timestamp || Date.now(),
              model: toolResult.model || req.request?.model || "unknown",
              platform: toolResult.platform || req.request?.platform || "api",
            });
          },
        });

        if (result?.status !== "error" || result?.data?.retryable === true) {
          recordToolCallAttempt?.();
        } else if (result?.data?.outcome === "unknown") {
          recordDeterministicFailure?.();
        }
      } catch (functionError: any) {
        logger.error(`Function execution error for ${functionName}:`, functionError);
        const errorType = functionError.type || "FUNCTION_EXECUTION_ERROR";

        if (isDeterministicToolCallError(errorType)) {
          recordDeterministicFailure?.();
        }

        const unknownTool = isUnknownToolError(functionError);
        const artifactMarkupCall = unknownTool && isArtifactMarkupToolName(functionName);
        const recoverable = unknownTool && options?.recoverUnknownToolCalls;
        const formattedError = formatToolErrorResponse(
          functionName,
          unknownTool
            ? buildUnknownToolCorrection(functionName)
            : functionError.message || "Function execution failed",
          errorType,
        );

        const errorMessage: Message = {
          role: "tool",
          name: functionName,
          content: formattedError.content,
          status: "error",
          data: unknownTool
            ? {
                ...formattedError.data,
                errorCode: "UNKNOWN_TOOL",
                ...(artifactMarkupCall ? { responseType: "hidden" } : {}),
                ...(recoverable ? { recoverable: true } : {}),
              }
            : formattedError.data,
          log_id: modelResponseLogId || "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        };

        await recordToolResult(errorMessage);
        continue;
      }

      if (!result) {
        logger.warn(`No result returned for tool call ${functionName}`);
        const nullResultError = formatToolErrorResponse(
          functionName,
          "Tool returned no result",
          "EMPTY_RESULT",
        );

        await recordToolResult({
          role: "tool",
          name: functionName,
          content: nullResultError.content,
          status: "error",
          data: nullResultError.data,
          log_id: modelResponseLogId || "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
          timestamp,
          model: req.request?.model || "unknown",
          platform: req.request?.platform || "api",
        });
        continue;
      }

      const formattedResponse = formatToolResponse(functionName, result.content || "", result.data);

      const message: Message = {
        role: "tool",
        name: functionName,
        content: formattedResponse.content,
        status: result.status || "success",
        data: formattedResponse.data,
        log_id: modelResponseLogId || "",
        id: generateId(),
        tool_call_id: toolCall.id,
        tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
        timestamp: Date.now(),
        model: req.request?.model || "unknown",
        platform: req.request?.platform || "api",
      };

      await recordToolResult(message);
    } catch (error) {
      const functionError = error as ToolCallError;
      const errorType = functionError.type || "TOOL_CALL_ERROR";

      if (isDeterministicToolCallError(errorType)) {
        recordDeterministicFailure?.();
      }

      logger.error(`Tool call error for ${functionName}:`, {
        error,
        type: errorType,
        status: functionError.status,
      });

      const formattedError = formatToolErrorResponse(
        functionName,
        isUnknownToolError(functionError)
          ? buildUnknownToolCorrection(functionName)
          : functionError.message || "Unknown error occurred",
        errorType,
      );
      const recoverable = isRecoverableToolCallError({
        errorType,
        toolCallId: toolCall.id,
        functionName,
      });

      const errorMessage: Message = {
        role: "tool",
        name: toolCall.name || functionName,
        content: formattedError.content,
        status: "error",
        data: isUnknownToolError(functionError)
          ? {
              ...formattedError.data,
              errorCode: "UNKNOWN_TOOL",
              ...(isArtifactMarkupToolName(functionName) ? { responseType: "hidden" } : {}),
              ...(options?.recoverUnknownToolCalls ? { recoverable: true } : {}),
            }
          : recoverable
            ? { ...formattedError.data, recoverable: true }
            : formattedError.data,
        log_id: modelResponseLogId || "",
        id: generateId(),
        tool_call_id: toolCall.id,
        tool_call_arguments: toolCall.arguments || toolCall.function?.arguments,
        timestamp,
        model: req.request?.model || "unknown",
        platform: req.request?.platform || "api",
      };

      await recordToolResult(errorMessage);
    }
  }

  if (persistResults === "batch" && functionResults.length > 0) {
    try {
      await conversationManager.addBatch(completion_id, functionResults);
    } catch (error) {
      logger.error("Failed to store tool call results:", {
        error,
        completion_id,
      });
    }
  }

  return functionResults;
};
