import { extractTextFromMessageContent, type AIProvider } from "@ngriffin_uk/polychat-ai-providers";
import {
  agentHostReasoningEffortSchema,
  agentHostRunIdSchema,
  type AgentHostRunRequest,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveHostedAgentRunModel } from "~/modules/models/application/hosted-agent-model";
import type { ChatCompletionParameters, IUser } from "~/types";

import { HERMES_AGENT_HOST_SPEC, type AgentHostSpec } from "./agentHostSpec";
import { requireHostedAgentAccess } from "./hostedAgentAccess";
import { resolveAgentNetworkHosts } from "./hostedAgentInput";
import { runHostedAgentTurn } from "./hostedAgentTurn";

function readAgentApprovalResolution(
  options: ChatCompletionParameters["options"],
  spec: AgentHostSpec,
):
  | {
      runId: string;
      requestId?: string;
      choice: "once" | "deny";
    }
  | undefined {
  const interaction = options?.toolInteraction;

  if (interaction?.toolName !== spec.approvalTool) {
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
      `This ${spec.displayName} approval request is no longer valid`,
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

function describeApproval(approval: { command?: string; description?: string }): string {
  const description = approval.description?.trim();
  const command = approval.command?.trim();

  if (description && command && command !== description) {
    return `${description} (${command})`;
  }

  return description || command || "an action";
}

async function resolveAgentRunModelSelection(
  params: ChatCompletionParameters,
  context: ServiceContext,
  user: IUser,
  spec: AgentHostSpec,
): Promise<{ model: string; modelOptions?: AgentHostRunRequest["modelOptions"] }> {
  const projectId =
    typeof params.metadata?.project_id === "string" ? params.metadata.project_id : undefined;
  const resolved = await resolveHostedAgentRunModel({
    context,
    user,
    role: "agent",
    capability: spec.displayName,
    ...(projectId ? { projectId } : {}),
  });
  const requestedEffort = agentHostReasoningEffortSchema.safeParse(params.reasoning_effort);
  const lineupEffort = agentHostReasoningEffortSchema.safeParse(resolved.effort);
  const effort = requestedEffort.success
    ? requestedEffort.data
    : lineupEffort.success
      ? lineupEffort.data
      : undefined;

  return {
    model: resolved.model,
    ...(effort ? { modelOptions: { reasoning_effort: effort } } : {}),
  };
}

export class HostedAgentChatProvider implements AIProvider {
  readonly name: string;
  readonly supportsStreaming = false;

  constructor(private readonly spec: AgentHostSpec = HERMES_AGENT_HOST_SPEC) {
    this.name = spec.providerName;
  }

  async getResponse(params: ChatCompletionParameters) {
    const { context, user, client } = requireHostedAgentAccess(params.context, this.spec);
    const approvalResolution = readAgentApprovalResolution(params.options, this.spec);
    const input = approvalResolution
      ? undefined
      : extractTextFromMessageContent(params.messages?.at(-1)?.content);

    if ((!approvalResolution && !input) || !params.completion_id) {
      throw new AssistantError(
        `${this.spec.displayName} needs a message in a conversation`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const networkHosts = resolveAgentNetworkHosts(params.options);
    const modelSelection = approvalResolution
      ? {}
      : await resolveAgentRunModelSelection(params, context, user, this.spec);
    const result = await runHostedAgentTurn({
      context,
      client,
      spec: this.spec,
      userId: user.id,
      conversationId: params.completion_id,
      input,
      systemPrompt: params.system_prompt,
      ...(networkHosts.length > 0 ? { networkHosts } : {}),
      ...modelSelection,
      ...(approvalResolution ? { resume: approvalResolution } : {}),
    });

    if (result.approval) {
      const action = describeApproval(result.approval);

      return {
        response: "",
        model: this.spec.modelName,
        provider: this.name,
        tool_calls: [
          {
            id: approvalToolCallId(result.runId, result.approval.request_id),
            type: "function",
            function: {
              name: this.spec.approvalTool,
              arguments: JSON.stringify({
                message: `${this.spec.displayName} needs your approval: ${action}`,
                options: ["Approve", "Reject"],
              }),
            },
          },
        ],
      };
    }

    return {
      response: result.output,
      model: this.spec.modelName,
      provider: this.name,
      ...(result.usage
        ? {
            usage: {
              input_tokens: result.usage.input_tokens,
              output_tokens: result.usage.output_tokens,
              total_tokens: result.usage.total_tokens,
            },
          }
        : {}),
      data: {
        agentRunId: result.runId,
        ...(result.sessionId ? { agentSessionId: result.sessionId } : {}),
        ...(result.runtime ? { agentRuntime: result.runtime } : {}),
        ...(result.toolsUsed && result.toolsUsed.length > 0
          ? { agentToolsUsed: result.toolsUsed }
          : {}),
        ...(result.subagentCompletions
          ? { agentSubagentCompletions: result.subagentCompletions }
          : {}),
      },
    };
  }
}
