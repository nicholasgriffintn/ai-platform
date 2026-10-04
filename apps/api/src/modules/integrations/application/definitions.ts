import { discoverNativeMcpSnapshot, NativeMcpError } from "@ngriffin_uk/polychat-ai-integrations";
import type {
  CreateIntegration,
  IntegrationDefinition,
  IntegrationSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireWorkspaceAccess, requireWorkAccess } from "~/modules/workspaces/application/access";

import { requireIntegrationDefinition } from "./access";
import { integrationDefinitionView } from "./catalogue";
import { readIntegrationConnection, storeIntegrationConnection } from "./connections";
import { recordIntegrationDefinitionAudit } from "./definition-audit";

async function discoverSnapshot(
  settings: Pick<IntegrationSnapshot, "endpoint" | "authentication"> & { token?: string },
) {
  try {
    return await discoverNativeMcpSnapshot(settings);
  } catch (error) {
    if (error instanceof NativeMcpError) {
      throw new AssistantError(
        error.message,
        error.code === "INVALID_INPUT" ? ErrorType.PARAMS_ERROR : ErrorType.PROVIDER_ERROR,
        error.code === "INVALID_INPUT" ? 400 : 502,
      );
    }

    throw error;
  }
}

async function requireDefinitionCreationAccess(context: ServiceContext, workspaceId?: string) {
  const user = requireWorkAccess(context);

  if (workspaceId) {
    await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  }

  return user;
}

export async function createNativeIntegrationDefinition(
  context: ServiceContext,
  input: CreateIntegration,
): Promise<{ integration: IntegrationDefinition }> {
  const user = await requireDefinitionCreationAccess(context, input.workspaceId);

  if (!context.env.JWT_SECRET) {
    throw new AssistantError(
      "Credential encryption is not configured",
      ErrorType.CONFIGURATION_ERROR,
      500,
    );
  }

  const snapshot = await discoverSnapshot(input);

  await requireDefinitionCreationAccess(context, input.workspaceId);
  const definition = await context.repositories.integrationDefinitions.create({
    ...input,
    userId: user.id,
    snapshot,
  });

  await storeIntegrationConnection({
    context,
    userId: user.id,
    definitionId: definition.id,
    snapshot,
    token: input.token,
  });
  await recordIntegrationDefinitionAudit(context, definition, "created");

  return { integration: await integrationDefinitionView(context, definition) };
}

export async function connectNativeIntegrationAccount(
  context: ServiceContext,
  id: string,
  token?: string,
): Promise<{ integration: IntegrationDefinition }> {
  const user = context.requireUser();
  const { definition } = await requireIntegrationDefinition(context, id);

  await discoverSnapshot({ ...definition.snapshot, token });
  const current = await requireIntegrationDefinition(context, id);

  if (current.definition.revision !== definition.revision) {
    throw new AssistantError(
      "The integration changed while connecting; try again",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await storeIntegrationConnection({
    context,
    userId: user.id,
    definitionId: id,
    snapshot: definition.snapshot,
    token,
  });
  const latest = await context.repositories.integrationDefinitions.get(id);

  if (!latest || latest.revoked) {
    throw new AssistantError("Integration not found", ErrorType.NOT_FOUND, 404);
  }

  return { integration: await integrationDefinitionView(context, latest) };
}

export async function reviewNativeIntegrationDefinition(
  context: ServiceContext,
  id: string,
): Promise<{ currentRevision: number; snapshot: IntegrationSnapshot }> {
  const user = context.requireUser();
  const { definition } = await requireIntegrationDefinition(context, id, "write");
  const connection = await readIntegrationConnection({
    context,
    userId: user.id,
    definitionId: id,
    snapshot: definition.snapshot,
  });

  if (!connection) {
    throw new AssistantError(
      "Connect your own account before reviewing service changes",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const snapshot = await discoverSnapshot({ ...definition.snapshot, token: connection.token });
  const current = await requireIntegrationDefinition(context, id, "write");

  if (current.definition.revision !== definition.revision) {
    throw new AssistantError(
      "The integration changed during review; refresh and try again",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return { currentRevision: definition.revision, snapshot };
}

export async function publishNativeIntegrationRevision(
  context: ServiceContext,
  id: string,
  input: { expectedRevision: number; expectedDigest: string },
): Promise<{ integration: IntegrationDefinition }> {
  const review = await reviewNativeIntegrationDefinition(context, id);

  if (
    review.currentRevision !== input.expectedRevision ||
    review.snapshot.digest !== input.expectedDigest
  ) {
    throw new AssistantError(
      "The service changed since your review; review it again before saving",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const definition = await context.repositories.integrationDefinitions.revise({
    id,
    expectedRevision: input.expectedRevision,
    snapshot: review.snapshot,
  });

  await recordIntegrationDefinitionAudit(context, definition, "reviewed");

  return { integration: await integrationDefinitionView(context, definition) };
}
