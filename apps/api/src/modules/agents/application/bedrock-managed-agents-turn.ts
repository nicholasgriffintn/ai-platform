import { getModels } from "@ngriffin_uk/polychat-ai-models";
import {
  bedrockManagedAgentTargetSchema,
  type AgentHarnessEventRecord,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { BedrockManagedAgentsClient } from "~/infrastructure/providers/agents/BedrockManagedAgentsClient";
import { getModelConfig } from "~/modules/models/application/resolve";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { IUser } from "~/types";

import {
  agentSessionInput,
  agentSessionTurnRecords,
  type AgentSessionTranscriptEntry,
} from "./agent-session-turn";

const HARNESS_NAME = "Bedrock Managed Agents";
const MANTLE_PROVIDER = "bedrock-mantle";
const MANTLE_AGENT_MODEL_PREFIX = "openai.";
const WORKSPACE_DIRECTORY = "/workspace";

function isMantleAgentModel(model: ModelConfigItem): boolean {
  return (
    model.provider === MANTLE_PROVIDER &&
    model.kind !== "agent" &&
    model.supportsToolCalls &&
    model.matchingModel.startsWith(MANTLE_AGENT_MODEL_PREFIX)
  );
}

export async function resolveBedrockManagedAgentModel(params: {
  context: ServiceContext;
  user: IUser;
  preferred: string;
}): Promise<string> {
  const candidates = Object.values(getModels()).filter(isMantleAgentModel);
  const preferred = await getModelConfig(
    params.preferred,
    params.context.env,
    undefined,
    params.user.id,
  );
  const preferredIds = preferred
    ? [preferred.matchingModel, `${MANTLE_AGENT_MODEL_PREFIX}${preferred.matchingModel}`]
    : [];
  const selected =
    candidates.find((model) => preferredIds.includes(model.matchingModel)) ?? candidates[0];

  if (!selected) {
    throw new AssistantError(
      `${HARNESS_NAME} has no Bedrock OpenAI model to run`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return selected.matchingModel;
}

async function resolveWorkspaceAccount(context: ServiceContext, projectId?: string) {
  if (!projectId) {
    throw new AssistantError(
      `${HARNESS_NAME} runs in projects whose workspace has an AWS connection`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const { project } = await requireProjectAccess(context, projectId);
  const [connection, secrets] = await Promise.all([
    context.repositories.modelConnections.getConnection(project.workspace_id, "aws"),
    context.repositories.modelConnections.getSecrets(project.workspace_id, "aws"),
  ]);

  if (!connection || !secrets.accessKeyId || !secrets.secretAccessKey) {
    throw new AssistantError(
      "Connect AWS under Models › Governance in this workspace",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  const target = bedrockManagedAgentTargetSchema.safeParse({
    runtimeArn: connection.config.agentRuntimeArn ?? "",
    roleArn: connection.config.roleArn ?? "",
  });

  if (!target.success) {
    throw new AssistantError(
      `Add an AgentCore Runtime ARN to this workspace's AWS connection: ${target.error.issues[0]?.message}`,
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  return {
    target: target.data,
    client: new BedrockManagedAgentsClient(target.data.region, {
      accessKeyId: secrets.accessKeyId,
      secretAccessKey: secrets.secretAccessKey,
      ...(secrets.sessionToken ? { sessionToken: secrets.sessionToken } : {}),
    }),
  };
}

export async function startBedrockManagedAgentsTurn(params: {
  context: ServiceContext;
  projectId?: string;
  model: string;
  instructions?: string;
  transcript: readonly AgentSessionTranscriptEntry[];
  operationId: string;
}): Promise<AsyncGenerator<AgentHarnessEventRecord>> {
  const { target, client } = await resolveWorkspaceAccount(params.context, params.projectId);

  return agentSessionTurnRecords(
    {
      harnessName: HARNESS_NAME,
      start: () =>
        client.createSession({
          agent: {
            model: params.model,
            ...(params.instructions ? { instructions: params.instructions } : {}),
          },
          environment: {
            type: "aws_bedrock_agentcore",
            runtime_arn: target.runtimeArn,
            runtime_qualifier: "DEFAULT",
            workspace_directory: WORKSPACE_DIRECTORY,
          },
          role_arn: target.roleArn,
          input: agentSessionInput(params.transcript),
          metadata: { polychat_operation_id: params.operationId },
          stream: true,
        }),
      deleteSession: (sessionId) => client.deleteSession(sessionId),
    },
    params.operationId,
  );
}
