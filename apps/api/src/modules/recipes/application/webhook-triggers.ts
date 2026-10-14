import type {
  RecipeWebhookTrigger,
  RecipeWebhookTriggerCreateRequest,
  RecipeWebhookTriggerSecret,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RecipeWebhookTriggerRecord } from "~/modules/recipes/infrastructure/RecipeWebhookTriggerRepository";
import {
  createWebhookToken,
  hashWebhookToken,
  recipeWebhookUrl,
} from "~/modules/webhooks/domain/recipe-webhook-token";

import { requireOwnedRecipeInstallation } from "./owned-installation";

function toTrigger(record: RecipeWebhookTriggerRecord): RecipeWebhookTrigger {
  return {
    id: record.id,
    installationId: record.installation_id,
    projectId: record.project_id,
    condition: record.condition,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

async function requireOwnedTrigger(params: {
  context: ServiceContext;
  userId: number;
  triggerId: string;
}): Promise<RecipeWebhookTriggerRecord | null> {
  const trigger = await params.context.repositories.recipeWebhookTriggers.getTriggerForOwner(
    params.triggerId,
    params.userId,
  );

  if (!trigger) {
    return null;
  }

  await requireOwnedRecipeInstallation({
    context: params.context,
    userId: params.userId,
    installationId: trigger.installation_id,
  });

  return trigger;
}

export async function createRecipeWebhookTrigger(params: {
  context: ServiceContext;
  userId: number;
  installationId: string;
  input: RecipeWebhookTriggerCreateRequest;
}): Promise<RecipeWebhookTriggerSecret> {
  const { record } = await requireOwnedRecipeInstallation(params);

  if (record.status !== "active") {
    throw new AssistantError("Paused recipes cannot add webhooks", ErrorType.PARAMS_ERROR, 400);
  }

  const token = createWebhookToken();
  const trigger = await params.context.repositories.recipeWebhookTriggers.createTrigger({
    installationId: record.id,
    createdByUserId: params.userId,
    projectId: record.project_id,
    tokenHash: await hashWebhookToken(token),
    condition: params.input.condition,
  });

  return { ...toTrigger(trigger), url: recipeWebhookUrl(params.context.env, token) };
}

export async function listRecipeWebhookTriggers(params: {
  context: ServiceContext;
  userId: number;
  installationId: string;
}): Promise<{ triggers: RecipeWebhookTrigger[] }> {
  await requireOwnedRecipeInstallation(params);
  const records = await params.context.repositories.recipeWebhookTriggers.listInstallationTriggers(
    params.installationId,
    params.userId,
  );

  return { triggers: records.map(toTrigger) };
}

export async function setRecipeWebhookTriggerStatus(params: {
  context: ServiceContext;
  userId: number;
  triggerId: string;
  status: "active" | "paused";
}): Promise<RecipeWebhookTrigger | null> {
  const trigger = await requireOwnedTrigger(params);

  if (!trigger) {
    return null;
  }

  const updated = await params.context.repositories.recipeWebhookTriggers.updateStatus(
    trigger.id,
    params.userId,
    params.status,
  );

  return updated ? toTrigger(updated) : null;
}

export async function rotateRecipeWebhookTrigger(params: {
  context: ServiceContext;
  userId: number;
  triggerId: string;
}): Promise<RecipeWebhookTriggerSecret | null> {
  const trigger = await requireOwnedTrigger(params);

  if (!trigger) {
    return null;
  }

  const token = createWebhookToken();
  const updated = await params.context.repositories.recipeWebhookTriggers.rotateToken(
    trigger.id,
    params.userId,
    await hashWebhookToken(token),
  );

  return updated
    ? { ...toTrigger(updated), url: recipeWebhookUrl(params.context.env, token) }
    : null;
}

export async function deleteRecipeWebhookTrigger(params: {
  context: ServiceContext;
  userId: number;
  triggerId: string;
}): Promise<boolean> {
  const trigger = await requireOwnedTrigger(params);

  return trigger
    ? params.context.repositories.recipeWebhookTriggers.deleteTrigger(trigger.id, params.userId)
    : false;
}
