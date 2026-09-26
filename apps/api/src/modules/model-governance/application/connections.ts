import {
  createConnectionChecker,
  defaultFetcher,
  type HubAccess,
  HuggingFaceHubClient,
  listProviderManifests,
  type ProviderAdapterContext,
  providerManifest,
} from "@ngriffin_uk/polychat-ai-model-providers";
import type {
  ConnectionCheck,
  ModelConnection,
  ModelProviderId,
  ProviderCatalogueResponse,
  SaveModelConnectionRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  badRequest,
  conflict,
  requireModelAction,
} from "~/modules/model-registry/application/access";

import type { ModelConnectionRecord } from "../infrastructure/ModelConnectionRepository";
import { withProviderErrors } from "./provider-errors";

function toModelConnection(record: ModelConnectionRecord): ModelConnection {
  return {
    provider: record.provider,
    account: record.account,
    config: record.config,
    secretKeys: record.secretKeys,
    capabilities: record.capabilities,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  };
}

export async function resolveHubAccess(
  repositories: RepositoryManager,
  workspaceId: string,
): Promise<HubAccess | null> {
  const [connection, secrets] = await Promise.all([
    repositories.modelConnections.getConnection(workspaceId, "huggingface"),
    repositories.modelConnections.getSecrets(workspaceId, "huggingface"),
  ]);

  return connection && secrets.token && connection.config.namespace
    ? { token: secrets.token, namespace: connection.config.namespace }
    : null;
}

export async function workspaceHubClient(
  repositories: RepositoryManager,
  workspaceId: string,
): Promise<HuggingFaceHubClient> {
  const hub = await resolveHubAccess(repositories, workspaceId);

  return new HuggingFaceHubClient({ token: hub?.token });
}

export async function requireHubAccess(
  repositories: RepositoryManager,
  workspaceId: string,
): Promise<HubAccess> {
  const hub = await resolveHubAccess(repositories, workspaceId);

  if (!hub) {
    throw conflict("Connect Hugging Face with write access under Models › Governance first");
  }

  return hub;
}

export async function resolveProviderContext(
  repositories: RepositoryManager,
  workspaceId: string,
  provider: ModelProviderId,
): Promise<ProviderAdapterContext> {
  const [connection, secrets, hub] = await Promise.all([
    repositories.modelConnections.getConnection(workspaceId, provider),
    repositories.modelConnections.getSecrets(workspaceId, provider),
    resolveHubAccess(repositories, workspaceId),
  ]);

  if (!connection) {
    throw conflict(`Connect ${providerManifest(provider).name} under Models › Governance first`);
  }

  return { credentials: { secrets, config: connection.config }, fetcher: defaultFetcher, hub };
}

export async function listProviderCatalogue(
  context: ServiceContext,
  workspaceId: string,
): Promise<ProviderCatalogueResponse> {
  await requireModelAction(context, workspaceId, "view");

  const connections = await context.repositories.modelConnections.listConnections(workspaceId);

  return {
    providers: listProviderManifests().map((manifest) => {
      const connection = connections.find((item) => item.provider === manifest.id);

      return { manifest, connection: connection ? toModelConnection(connection) : null };
    }),
  };
}

async function mergedCredentials(
  context: ServiceContext,
  workspaceId: string,
  provider: ModelProviderId,
  request: SaveModelConnectionRequest,
) {
  const manifest = providerManifest(provider);
  const existing = await context.repositories.modelConnections.getSecrets(workspaceId, provider);
  const secretKeys = new Set(
    manifest.connection.fields.filter((field) => field.kind === "secret").map((field) => field.key),
  );
  const configKeys = new Set(
    manifest.connection.fields.filter((field) => field.kind !== "secret").map((field) => field.key),
  );
  const secrets = Object.fromEntries(
    Object.entries({ ...existing, ...request.secrets }).filter(
      ([key, value]) => secretKeys.has(key) && value.length > 0,
    ),
  );
  const config = Object.fromEntries(
    Object.entries(request.config).filter(
      ([key, value]) => configKeys.has(key) && value.length > 0,
    ),
  );

  for (const field of manifest.connection.fields) {
    const value = field.kind === "secret" ? secrets[field.key] : config[field.key];

    if (field.required && !value) {
      throw badRequest(`${manifest.name} needs ${field.label.toLowerCase()}`);
    }

    if (
      field.kind === "select" &&
      value &&
      !field.options?.some((option) => option.value === value)
    ) {
      throw badRequest(`Choose a listed ${field.label.toLowerCase()}`);
    }
  }

  return { secrets, config };
}

async function runCheck(
  context: ServiceContext,
  workspaceId: string,
  provider: ModelProviderId,
  credentials: { secrets: Record<string, string>; config: Record<string, string> },
): Promise<ConnectionCheck> {
  const hub =
    provider === "huggingface" && credentials.secrets.token && credentials.config.namespace
      ? { token: credentials.secrets.token, namespace: credentials.config.namespace }
      : await resolveHubAccess(context.repositories, workspaceId);

  return withProviderErrors(
    () => createConnectionChecker(provider, { credentials, fetcher: defaultFetcher, hub }).check(),
    { unauthorised: `${providerManifest(provider).name} rejected these credentials` },
  );
}

export async function checkModelConnection(
  context: ServiceContext,
  workspaceId: string,
  provider: ModelProviderId,
  request: SaveModelConnectionRequest,
): Promise<ConnectionCheck> {
  await requireModelAction(context, workspaceId, "manage_connections");

  return runCheck(
    context,
    workspaceId,
    provider,
    await mergedCredentials(context, workspaceId, provider, request),
  );
}

export async function saveModelConnection(
  context: ServiceContext,
  workspaceId: string,
  provider: ModelProviderId,
  request: SaveModelConnectionRequest,
): Promise<ModelConnection> {
  const { userId } = await requireModelAction(context, workspaceId, "manage_connections");
  const credentials = await mergedCredentials(context, workspaceId, provider, request);
  const check = await runCheck(context, workspaceId, provider, credentials);

  await context.repositories.modelConnections.saveConnection({
    workspaceId,
    provider,
    secrets: credentials.secrets,
    account: check.account,
    config: credentials.config,
    capabilities: check.capabilities,
    updatedBy: userId,
  });
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_connection.saved",
    targetType: "model_connection",
    targetId: provider,
    metadata: {
      account: check.account,
      capabilities: check.capabilities,
      config: credentials.config,
      secretsReplaced: Object.keys(request.secrets),
    },
  });

  const saved = await context.repositories.modelConnections.getConnection(workspaceId, provider);

  if (!saved) {
    throw conflict("The connection did not save");
  }

  return toModelConnection(saved);
}

export async function deleteModelConnection(
  context: ServiceContext,
  workspaceId: string,
  provider: ModelProviderId,
): Promise<{ deleted: boolean }> {
  const { userId } = await requireModelAction(context, workspaceId, "manage_connections");
  const deleted = await context.repositories.modelConnections.deleteConnection(
    workspaceId,
    provider,
  );

  if (deleted) {
    await context.repositories.audit.createRecord({
      workspaceId,
      actorUserId: userId,
      action: "model_connection.removed",
      targetType: "model_connection",
      targetId: provider,
    });
  }

  return { deleted };
}
