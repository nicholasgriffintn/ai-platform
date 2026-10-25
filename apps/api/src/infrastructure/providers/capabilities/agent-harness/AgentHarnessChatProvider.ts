import { extractTextFromMessageContent, type AIProvider } from "@ngriffin_uk/polychat-ai-providers";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  AGENT_HARNESS_APPROVAL_TOOL,
  AGENT_HARNESS_DEFINITIONS,
  AGENT_HARNESS_PROVIDER,
  agentHarnessIdSchema,
  isHostedAgentHarness,
  reasoningEffortSchema,
  resolveEffectivePermissionMode,
  type AgentHarnessId,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  collectHarnessProviderStream,
  parseApprovalToolCallId,
} from "~/modules/agents/application/harness-stream";
import {
  startHostedHarnessTurn,
  streamHarnessRecords,
} from "~/modules/agents/application/harness-turn";
import { startRemoteHarnessTurn } from "~/modules/agents/application/remote-harness-turn";
import { resolveHostedAgentRunModel } from "~/modules/responses/application/engine/policy/hosted-agent-model";
import type { ChatCompletionParameters, IUser } from "~/types";

function requireHarnessAccess(
  context: ServiceContext | undefined,
  harness: AgentHarnessId,
): { context: ServiceContext; user: IUser } {
  const user = context?.user;
  const name = AGENT_HARNESS_DEFINITIONS[harness].name;

  if (!context || !user?.id) {
    throw new AssistantError(`Sign in to use ${name}`, ErrorType.AUTHENTICATION_ERROR, 401);
  }

  if (!hasProEntitlement(user)) {
    throw new AssistantError(
      `${name} is available on paid plans`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  return { context, user };
}

function readApprovalResolution(options: ChatCompletionParameters["options"]) {
  const interaction = options?.toolInteraction;

  if (interaction?.toolName !== AGENT_HARNESS_APPROVAL_TOOL) {
    return undefined;
  }

  const reference = parseApprovalToolCallId(interaction.response.interactionId);
  const resolution = interaction.response.resolution;

  if (!reference || (resolution !== "approved" && resolution !== "rejected")) {
    throw new AssistantError(
      "This approval request is no longer valid",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return { ...reference, approved: resolution === "approved" };
}

export class AgentHarnessChatProvider implements AIProvider {
  readonly name = AGENT_HARNESS_PROVIDER;
  readonly supportsStreaming = true;

  private async openStream(params: ChatCompletionParameters): Promise<ReadableStream<Uint8Array>> {
    const harness = agentHarnessIdSchema.parse(params.model);
    const definition = AGENT_HARNESS_DEFINITIONS[harness];
    const { context, user } = requireHarnessAccess(params.context, harness);
    const conversationId = params.completion_id;

    if (!conversationId) {
      throw new AssistantError(`${definition.name} needs a conversation`, ErrorType.PARAMS_ERROR);
    }

    const resume = readApprovalResolution(params.options);
    const input = resume
      ? undefined
      : extractTextFromMessageContent(params.messages?.at(-1)?.content).trim();

    if (!resume && !input) {
      throw new AssistantError(`${definition.name} needs a message`, ErrorType.PARAMS_ERROR);
    }

    const projectId =
      typeof params.metadata?.project_id === "string" ? params.metadata.project_id : undefined;
    const selected = await resolveHostedAgentRunModel({
      context,
      user,
      role: "agent",
      capability: definition.name,
      ...(projectId ? { projectId } : {}),
      ...(params.model_tier ? { tier: params.model_tier } : {}),
    });
    const requestedEffort = reasoningEffortSchema.safeParse(params.reasoning_effort);
    const reasoningEffort = requestedEffort.success ? requestedEffort.data : selected.effort;
    const instructions = params.system_prompt?.trim();

    if (!isHostedAgentHarness(harness)) {
      return streamHarnessRecords({
        records: await startRemoteHarnessTurn({
          harness,
          context,
          user,
          preferredModel: selected.model,
          messages: params.messages,
          ...(instructions ? { instructions } : {}),
          ...(projectId ? { projectId } : {}),
        }),
        harnessName: definition.name,
        checkIn: async () => undefined,
      });
    }

    const client = context.env.AGENT_WORKER;

    if (!client) {
      throw new AssistantError(
        "Hosted agents are not configured on this server",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return startHostedHarnessTurn({
      context,
      client,
      harness,
      userId: user.id,
      conversationId,
      model: selected.model,
      permissionMode: resolveEffectivePermissionMode(
        params.permission_mode,
        undefined,
        definition.permissionModes,
      ),
      ...(input ? { input } : {}),
      ...(instructions ? { instructions } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {}),
      ...(resume ? { resume } : {}),
    });
  }

  async getResponse(params: ChatCompletionParameters) {
    const stream = await this.openStream(params);

    if (params.stream) {
      return stream;
    }

    const collected = await collectHarnessProviderStream(stream);

    if (collected.error && !collected.response && collected.toolCalls.length === 0) {
      throw new AssistantError(collected.error, ErrorType.PROVIDER_ERROR);
    }

    return {
      response: collected.response,
      model: params.model,
      provider: this.name,
      ...(collected.toolCalls.length > 0 ? { tool_calls: collected.toolCalls } : {}),
    };
  }
}
