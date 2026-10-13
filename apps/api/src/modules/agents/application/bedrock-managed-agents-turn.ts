import { getModels } from "@ngriffin_uk/polychat-ai-models";
import { parseAwsCredentials } from "@ngriffin_uk/polychat-ai-providers";
import {
  bedrockManagedAgentTargetSchema,
  type AgentHarnessEventRecord,
  type BedrockManagedAgentTarget,
  type ModelConfigItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  BedrockManagedAgentsClient,
  type BedrockManagedAgentsCredentials,
} from "~/infrastructure/providers/agents/BedrockManagedAgentsClient";
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

interface BedrockManagedAgentAccount {
  target: BedrockManagedAgentTarget;
  credentials: BedrockManagedAgentsCredentials;
}

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

function missingConfiguration(message: string): AssistantError {
  return new AssistantError(message, ErrorType.CONFIGURATION_ERROR, 409);
}

function parseTarget(
  fields: { runtimeArn?: string | null; roleArn?: string | null },
  location: string,
): BedrockManagedAgentTarget {
  const target = bedrockManagedAgentTargetSchema.safeParse({
    runtimeArn: fields.runtimeArn ?? "",
    roleArn: fields.roleArn ?? "",
  });

  if (!target.success) {
    throw missingConfiguration(
      `Add an AgentCore Runtime and role to ${location}: ${target.error.issues[0]?.message}`,
    );
  }

  return target.data;
}

async function resolveWorkspaceAccount(
  context: ServiceContext,
  projectId: string,
): Promise<BedrockManagedAgentAccount> {
  const { project } = await requireProjectAccess(context, projectId);
  const [connection, secrets] = await Promise.all([
    context.repositories.modelConnections.getConnection(project.workspace_id, "aws"),
    context.repositories.modelConnections.getSecrets(project.workspace_id, "aws"),
  ]);

  if (!connection || !secrets.accessKeyId || !secrets.secretAccessKey) {
    throw missingConfiguration("Connect AWS under Models › Governance in this workspace");
  }

  return {
    target: parseTarget(
      { runtimeArn: connection.config.agentRuntimeArn, roleArn: connection.config.roleArn },
      "this workspace's AWS connection",
    ),
    credentials: {
      accessKeyId: secrets.accessKeyId,
      secretAccessKey: secrets.secretAccessKey,
      ...(secrets.sessionToken ? { sessionToken: secrets.sessionToken } : {}),
    },
  };
}

async function resolvePersonalAccount(
  context: ServiceContext,
): Promise<BedrockManagedAgentAccount> {
  const user = context.requireUser();
  const [settings, apiKey] = await Promise.all([
    context.repositories.userSettings.getUserSettings(user.id),
    context.repositories.userSettings.getProviderApiKey(user.id, "bedrock"),
  ]);
  const target = parseTarget(
    {
      runtimeArn: settings?.bedrock_agent_runtime_arn,
      roleArn: settings?.bedrock_agent_role_arn,
    },
    "your settings",
  );

  if (!apiKey) {
    throw missingConfiguration("Add your Amazon Bedrock credentials in provider settings");
  }

  const { accessKey, secretKey } = parseAwsCredentials(apiKey);

  return { target, credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } };
}

export async function startBedrockManagedAgentsTurn(params: {
  context: ServiceContext;
  projectId?: string;
  model: string;
  instructions?: string;
  transcript: readonly AgentSessionTranscriptEntry[];
  operationId: string;
}): Promise<AsyncGenerator<AgentHarnessEventRecord>> {
  const { target, credentials } = params.projectId
    ? await resolveWorkspaceAccount(params.context, params.projectId)
    : await resolvePersonalAccount(params.context);
  const client = new BedrockManagedAgentsClient(target.region, credentials);

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
