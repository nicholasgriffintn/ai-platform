import { extractTextFromMessageContent, type AIProvider } from "@ngriffin_uk/polychat-ai-providers";
import { agentHostRunIdSchema, DEFAULT_MODEL_TIER } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ChatCompletionParameters } from "~/types";

import { requireHostedHermesAccess } from "./hostedHermesAccess";
import { runHostedHermesTurn } from "./hostedHermesTurn";

const HERMES_APPROVAL_TOOL = "request_approval";

function readHermesApprovalResolution(options: ChatCompletionParameters["options"]):
  | {
      runId: string;
      requestId?: string;
      choice: "once" | "deny";
    }
  | undefined {
  const interaction = options?.toolInteraction;

  if (interaction?.toolName !== HERMES_APPROVAL_TOOL) {
    return undefined;
  }

  const interactionId = interaction.response.interactionId;
  const responseId = typeof interactionId === "string" ? interactionId : "";
  const resolution = interaction.response.resolution;
  const separatorIndex = responseId.indexOf(":");
  const runId = separatorIndex > 0 ? responseId.slice(0, separatorIndex) : "";
  const approvalToken = separatorIndex > 0 ? responseId.slice(separatorIndex + 1) : "";
  const requestId = approvalToken.startsWith("request:")
    ? approvalToken.slice("request:".length)
    : undefined;
  const validRunId = agentHostRunIdSchema.safeParse(runId);

  if (
    !validRunId.success ||
    (resolution !== "approved" && resolution !== "rejected") ||
    (!requestId &&
      (!approvalToken.startsWith("generated:") || approvalToken.length === "generated:".length))
  ) {
    throw new AssistantError(
      "This Hermes approval request is no longer valid",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return {
    runId: validRunId.data,
    ...(requestId ? { requestId } : {}),
    choice: resolution === "approved" ? "once" : "deny",
  };
}

function approvalToolCallId(runId: string, requestId?: string): string {
  const approvalToken = requestId ? `request:${requestId}` : `generated:${generateId()}`;

  return `${runId}:${approvalToken}`;
}

export class HostedHermesChatProvider implements AIProvider {
  readonly name = "hermes";
  readonly supportsStreaming = false;

  async getResponse(params: ChatCompletionParameters) {
    const { context, user, client } = requireHostedHermesAccess(params.context);
    const approvalResolution = readHermesApprovalResolution(params.options);
    const input = approvalResolution
      ? undefined
      : extractTextFromMessageContent(params.messages?.at(-1)?.content);

    if ((!approvalResolution && !input) || !params.completion_id) {
      throw new AssistantError("Hermes needs a message in a conversation", ErrorType.PARAMS_ERROR);
    }

    const settings = await context.getUserSettings();
    const result = await runHostedHermesTurn({
      context,
      client,
      userId: user.id,
      conversationId: params.completion_id,
      input,
      modelTier: settings?.default_model_tier ?? DEFAULT_MODEL_TIER,
      ...(approvalResolution ? { resume: approvalResolution } : {}),
    });

    if (result.approval) {
      const action = result.approval.description || result.approval.command || "an action";

      return {
        response: "",
        model: "hermes",
        provider: this.name,
        tool_calls: [
          {
            id: approvalToolCallId(result.runId, result.approval.request_id),
            type: "function",
            function: {
              name: HERMES_APPROVAL_TOOL,
              arguments: JSON.stringify({
                message: `Hermes needs your approval: ${action}`,
                options: ["Approve", "Reject"],
              }),
            },
          },
        ],
      };
    }

    return {
      response: result.output,
      model: "hermes",
      provider: this.name,
      data: {
        hermesRunId: result.runId,
      },
    };
  }
}
