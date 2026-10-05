import { normaliseLowercaseList } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { validateGitHubPrivateKey } from "~/infrastructure/github/app-jwt";

import { encryptGitHubConnectionPayload } from "./connection-crypto";
import { GITHUB_CONNECTION_KIND, getGitHubAppConnectionForUserInstallation } from "./connections";
import { requireDefaultGitHubInstallationOwner } from "./installation-ownership";

export interface UpsertGitHubConnectionInput {
  installationId: number;
  appId: string;
  privateKey: string;
  webhookSecret?: string;
  repositories?: string[];
}

interface DefaultGitHubAppCredentials {
  appId: string;
  privateKey: string;
  webhookSecret?: string;
}

function resolveDefaultGitHubAppCredentials(context: ServiceContext): DefaultGitHubAppCredentials {
  const appId = context.env.GITHUB_APP_ID?.trim();
  const privateKeyRaw = context.env.GITHUB_APP_PRIVATE_KEY?.trim();
  const webhookSecret = context.env.GITHUB_APP_WEBHOOK_SECRET?.trim();

  if (!appId || !privateKeyRaw) {
    throw new AssistantError("Default GitHub App is not configured", ErrorType.CONFIGURATION_ERROR);
  }

  const normalizedPrivateKey = validateGitHubPrivateKey(privateKeyRaw);

  return {
    appId,
    privateKey: normalizedPrivateKey,
    webhookSecret: webhookSecret || undefined,
  };
}

export async function upsertGitHubConnectionForUser(
  context: ServiceContext,
  userId: number,
  input: UpsertGitHubConnectionInput,
): Promise<{ installationId: number }> {
  return saveGitHubConnection(context, userId, input, "user");
}

async function saveGitHubConnection(
  context: ServiceContext,
  userId: number,
  input: UpsertGitHubConnectionInput,
  credentialSource: "user" | "deployment",
): Promise<{ installationId: number }> {
  if (!context.env.JWT_SECRET) {
    throw new AssistantError("JWT secret not configured", ErrorType.CONFIGURATION_ERROR);
  }

  const normalizedPrivateKey = validateGitHubPrivateKey(input.privateKey);

  const encrypted = await encryptGitHubConnectionPayload({
    jwtSecret: context.env.JWT_SECRET,
    userId,
    payload: {
      credential_source: credentialSource,
      app_id: input.appId.trim(),
      private_key: normalizedPrivateKey,
      installation_id: input.installationId,
      webhook_secret: input.webhookSecret?.trim() || undefined,
      repositories: input.repositories ? normaliseLowercaseList(input.repositories) : undefined,
    },
  });

  await context.repositories.providerConnections.upsertConnection({
    userId,
    provider: "github",
    kind: GITHUB_CONNECTION_KIND,
    externalId: String(input.installationId),
    encryptedData: { encrypted },
  });

  return { installationId: input.installationId };
}

export async function upsertGitHubConnectionFromDefaultAppForUser(
  context: ServiceContext,
  userId: number,
  input: {
    installationId: number;
    repositories?: string[];
  },
): Promise<{ installationId: number }> {
  const credentials = resolveDefaultGitHubAppCredentials(context);

  await requireDefaultGitHubInstallationOwner(context, userId, {
    ...credentials,
    installationId: input.installationId,
  });

  return saveGitHubConnection(
    context,
    userId,
    {
      installationId: input.installationId,
      appId: credentials.appId,
      privateKey: credentials.privateKey,
      webhookSecret: credentials.webhookSecret,
      repositories: input.repositories,
    },
    "deployment",
  );
}

export async function replaceGitHubConnectionRepositories(
  context: ServiceContext,
  userId: number,
  installationId: number,
  repositories: string[],
) {
  const connection = await getGitHubAppConnectionForUserInstallation(
    context,
    userId,
    installationId,
  );

  return saveGitHubConnection(
    context,
    userId,
    {
      installationId,
      appId: connection.appId,
      privateKey: connection.privateKey,
      webhookSecret: connection.webhookSecret,
      repositories,
    },
    connection.credentialSource,
  );
}

export async function deleteGitHubConnectionForUser(
  context: ServiceContext,
  userId: number,
  installationId: number,
): Promise<void> {
  await context.repositories.providerConnections.deleteConnection(
    userId,
    "github",
    GITHUB_CONNECTION_KIND,
    String(installationId),
  );
}
