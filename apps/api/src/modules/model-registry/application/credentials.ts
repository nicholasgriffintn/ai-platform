import { HuggingFaceHubClient, type HubIdentity } from "@ngriffin_uk/polychat-ai-model-sources";
import {
  HUGGINGFACE_ENDPOINT_LOCATIONS,
  type HuggingFaceConnection,
  type HuggingFaceConnectionSource,
  type HuggingFaceTokenCheck,
  type SaveHuggingFaceConnectionRequest,
  type TrainingProviderCredentials,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { IEnv } from "~/types";

import { requireRegistryGovernor, requireRegistryMember } from "./access";
import { withHubErrors } from "./hub-errors";

const PROVIDER = "huggingface";
const [DEFAULT_LOCATION] = HUGGINGFACE_ENDPOINT_LOCATIONS;

export interface ResolvedHuggingFace {
  source: HuggingFaceConnectionSource;
  token: string | undefined;
  account: string | null;
  namespace: string | null;
  canWrite: boolean;
  endpointVendor: string;
  endpointRegion: string;
  updatedAt: string | null;
}

type HuggingFaceEnv = Pick<
  IEnv,
  | "HUGGINGFACE_TOKEN"
  | "HUGGINGFACE_NAMESPACE"
  | "HUGGINGFACE_ENDPOINT_VENDOR"
  | "HUGGINGFACE_ENDPOINT_REGION"
>;

export async function resolveHuggingFace(
  env: HuggingFaceEnv,
  repositories: RepositoryManager,
  workspaceId: string,
): Promise<ResolvedHuggingFace> {
  const connection = await repositories.workspaceProviderConnections.getConnection(
    workspaceId,
    PROVIDER,
  );

  if (connection) {
    return {
      source: "workspace",
      token:
        (await repositories.workspaceProviderConnections.getSecret(workspaceId, PROVIDER)) ??
        undefined,
      account: connection.account,
      namespace: connection.config.namespace ?? connection.account,
      canWrite: connection.config.canWrite === "true",
      endpointVendor: connection.config.endpointVendor ?? DEFAULT_LOCATION.vendor,
      endpointRegion: connection.config.endpointRegion ?? DEFAULT_LOCATION.region,
      updatedAt: connection.updatedAt,
    };
  }

  return {
    source: env.HUGGINGFACE_TOKEN ? "platform" : "none",
    token: env.HUGGINGFACE_TOKEN,
    account: null,
    namespace: env.HUGGINGFACE_TOKEN ? (env.HUGGINGFACE_NAMESPACE ?? null) : null,
    canWrite: Boolean(env.HUGGINGFACE_TOKEN && env.HUGGINGFACE_NAMESPACE),
    endpointVendor: env.HUGGINGFACE_ENDPOINT_VENDOR ?? DEFAULT_LOCATION.vendor,
    endpointRegion: env.HUGGINGFACE_ENDPOINT_REGION ?? DEFAULT_LOCATION.region,
    updatedAt: null,
  };
}

function canTrainAndDeploy(
  resolved: ResolvedHuggingFace,
): resolved is ResolvedHuggingFace & { token: string; namespace: string } {
  return resolved.canWrite && Boolean(resolved.token) && Boolean(resolved.namespace);
}

export async function requireTrainingCredentials(
  env: HuggingFaceEnv,
  repositories: RepositoryManager,
  workspaceId: string,
): Promise<TrainingProviderCredentials> {
  const resolved = await resolveHuggingFace(env, repositories, workspaceId);

  if (!canTrainAndDeploy(resolved)) {
    throw new AssistantError(
      "Connect a Hugging Face organisation with write access under Models › Govern to train or deploy",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return {
    huggingface: {
      token: resolved.token,
      namespace: resolved.namespace,
      endpointVendor: resolved.endpointVendor,
      endpointRegion: resolved.endpointRegion,
    },
  };
}

export async function resolveEndpointCredentials(
  env: HuggingFaceEnv,
  repositories: RepositoryManager,
  workspaceId: string,
): Promise<TrainingProviderCredentials> {
  const resolved = await resolveHuggingFace(env, repositories, workspaceId);

  return resolved.token
    ? {
        huggingface: {
          token: resolved.token,
          namespace: resolved.namespace,
          endpointVendor: resolved.endpointVendor,
          endpointRegion: resolved.endpointRegion,
        },
      }
    : {};
}

function toConnection(resolved: ResolvedHuggingFace): HuggingFaceConnection {
  return {
    source: resolved.source,
    account: resolved.account,
    organisation: resolved.namespace,
    endpointVendor: resolved.endpointVendor,
    endpointRegion: resolved.endpointRegion,
    canTrainAndDeploy: canTrainAndDeploy(resolved),
    updatedAt: resolved.updatedAt,
  };
}

async function identify(token: string): Promise<HubIdentity> {
  return withHubErrors(() => new HuggingFaceHubClient({ token }).whoAmI(), {
    unauthorised: "Hugging Face rejected that token",
  });
}

export async function getHuggingFaceConnection(
  context: ServiceContext,
  workspaceId: string,
): Promise<HuggingFaceConnection> {
  await requireRegistryMember(context, workspaceId);

  return toConnection(await resolveHuggingFace(context.env, context.repositories, workspaceId));
}

async function requireToken(
  context: ServiceContext,
  workspaceId: string,
  token: string | undefined,
): Promise<string> {
  const resolved =
    token ??
    (await context.repositories.workspaceProviderConnections.getSecret(workspaceId, PROVIDER));

  if (!resolved) {
    throw new AssistantError("Paste a Hugging Face access token", ErrorType.PARAMS_ERROR, 400);
  }

  return resolved;
}

export async function checkHuggingFaceToken(
  context: ServiceContext,
  workspaceId: string,
  token: string | undefined,
): Promise<HuggingFaceTokenCheck> {
  await requireRegistryGovernor(context, workspaceId);

  return identify(await requireToken(context, workspaceId, token));
}

export async function saveHuggingFaceConnection(
  context: ServiceContext,
  workspaceId: string,
  input: SaveHuggingFaceConnectionRequest,
): Promise<HuggingFaceConnection> {
  const { userId } = await requireRegistryGovernor(context, workspaceId);
  const token = await requireToken(context, workspaceId, input.token);
  const identity = await identify(token);
  const organisation = input.organisation
    ? identity.organisations.find((org) => org.name === input.organisation)
    : null;

  if (input.organisation && !organisation) {
    throw new AssistantError(
      `${identity.account} is not a member of ${input.organisation}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const location = HUGGINGFACE_ENDPOINT_LOCATIONS.find(
    (item) => item.vendor === input.endpointVendor && item.region === input.endpointRegion,
  );

  if (!location) {
    throw new AssistantError("Choose a supported endpoint location", ErrorType.PARAMS_ERROR, 400);
  }

  await context.repositories.workspaceProviderConnections.saveConnection({
    workspaceId,
    provider: PROVIDER,
    secret: token,
    account: identity.account,
    config: {
      namespace: organisation?.name ?? identity.account,
      canWrite: String(organisation ? organisation.canWrite : identity.canWrite),
      endpointVendor: location.vendor,
      endpointRegion: location.region,
    },
    updatedBy: userId,
  });
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "workspace_connection.saved",
    targetType: "workspace_connection",
    targetId: PROVIDER,
    metadata: {
      account: identity.account,
      namespace: organisation?.name ?? identity.account,
      tokenReplaced: Boolean(input.token),
    },
  });

  return getHuggingFaceConnection(context, workspaceId);
}

export async function deleteHuggingFaceConnection(
  context: ServiceContext,
  workspaceId: string,
): Promise<HuggingFaceConnection> {
  const { userId } = await requireRegistryGovernor(context, workspaceId);

  if (
    await context.repositories.workspaceProviderConnections.deleteConnection(workspaceId, PROVIDER)
  ) {
    await context.repositories.audit.createRecord({
      workspaceId,
      actorUserId: userId,
      action: "workspace_connection.removed",
      targetType: "workspace_connection",
      targetId: PROVIDER,
    });
  }

  return getHuggingFaceConnection(context, workspaceId);
}
