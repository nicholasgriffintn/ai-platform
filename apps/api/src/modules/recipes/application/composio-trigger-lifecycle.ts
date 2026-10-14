import {
  deleteComposioTriggerInstance,
  setComposioTriggerEnabled,
} from "@ngriffin_uk/polychat-ai-integrations";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

export async function syncRecipeComposioTriggerStatus(params: {
  context: ServiceContext;
  userId: number;
  installationId: string;
  enabled: boolean;
}): Promise<void> {
  const triggers =
    await params.context.repositories.recipeComposioTriggers.listInstallationTriggers(
      params.installationId,
      params.userId,
    );

  for (const trigger of triggers) {
    try {
      await setComposioTriggerEnabled({
        env: params.context.env,
        triggerId: trigger.external_trigger_id,
        enabled: params.enabled,
      });
      await params.context.repositories.recipeComposioTriggers.updateStatus(
        trigger.id,
        params.userId,
        params.enabled ? "active" : "paused",
      );
    } catch (error) {
      await params.context.repositories.recipeComposioTriggers.updateStatus(
        trigger.id,
        params.userId,
        "error",
        error instanceof Error ? error.message : "Trigger status update failed",
      );
    }
  }
}

export async function deleteRecipeComposioTriggers(params: {
  context: ServiceContext;
  userId: number;
  installationId: string;
}): Promise<void> {
  const triggers =
    await params.context.repositories.recipeComposioTriggers.listInstallationTriggers(
      params.installationId,
      params.userId,
    );

  for (const trigger of triggers) {
    await deleteComposioTriggerInstance({
      env: params.context.env,
      triggerId: trigger.external_trigger_id,
    });
  }
}
