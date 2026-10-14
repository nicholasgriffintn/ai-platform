import {
  listPageOf,
  type CreateInstallationTriggerRequest,
  type ListPage,
  type InstallationTrigger,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import {
  createRecipeComposioTrigger,
  deleteRecipeComposioTrigger,
  listRecipeComposioTriggers,
  setRecipeComposioTriggerStatus,
} from "./composio-triggers";
import {
  createRecipeWebhookTrigger,
  deleteRecipeWebhookTrigger,
  listRecipeWebhookTriggers,
  rotateRecipeWebhookTrigger,
  setRecipeWebhookTriggerStatus,
} from "./webhook-triggers";

interface TriggerScope {
  context: ServiceContext;
  userId: number;
}

function notFound(): never {
  throw new AssistantError("Trigger not found", ErrorType.NOT_FOUND, 404);
}

export async function listRecipeTriggers(
  scope: TriggerScope,
  installationId: string,
): Promise<ListPage<InstallationTrigger>> {
  const [composio, webhook] = await Promise.all([
    listRecipeComposioTriggers({ ...scope, installationId }),
    listRecipeWebhookTriggers({ ...scope, installationId }),
  ]);

  return listPageOf<InstallationTrigger>(
    [
      ...composio.triggers.map((trigger) => ({ ...trigger, broker: "composio" as const })),
      ...webhook.triggers.map((trigger) => ({ ...trigger, broker: "webhook" as const })),
    ],
    (trigger) => trigger.id,
  );
}

export async function createRecipeTrigger(
  scope: TriggerScope,
  installationId: string,
  request: CreateInstallationTriggerRequest,
) {
  if (request.broker === "composio") {
    const { broker, ...input } = request;

    return { ...(await createRecipeComposioTrigger({ ...scope, installationId, input })), broker };
  }

  const { broker, ...input } = request;

  return { ...(await createRecipeWebhookTrigger({ ...scope, installationId, input })), broker };
}

export async function requireInstallationTrigger(
  scope: TriggerScope,
  installationId: string,
  triggerId: string,
): Promise<InstallationTrigger> {
  const { data } = await listRecipeTriggers(scope, installationId);

  return data.find((trigger) => trigger.id === triggerId) ?? notFound();
}

export async function setRecipeTriggerStatus(
  scope: TriggerScope,
  triggerId: string,
  status: "active" | "paused",
): Promise<InstallationTrigger> {
  const composio = await setRecipeComposioTriggerStatus({ ...scope, triggerId, status });

  if (composio) {
    return { ...composio, broker: "composio" };
  }

  const webhook = await setRecipeWebhookTriggerStatus({ ...scope, triggerId, status });

  return webhook ? { ...webhook, broker: "webhook" } : notFound();
}

export async function deleteRecipeTrigger(
  scope: TriggerScope,
  triggerId: string,
): Promise<{ deleted: true }> {
  const deleted =
    (await deleteRecipeComposioTrigger({ ...scope, triggerId })) ||
    (await deleteRecipeWebhookTrigger({ ...scope, triggerId }));

  return deleted ? { deleted: true } : notFound();
}

export async function rotateRecipeTrigger(scope: TriggerScope, triggerId: string) {
  const rotated = await rotateRecipeWebhookTrigger({ ...scope, triggerId });

  return rotated ? { ...rotated, broker: "webhook" as const } : notFound();
}
