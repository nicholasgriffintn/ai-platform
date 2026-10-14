import type {
  ComposioTriggerType,
  CreateInstallationTriggerRequest,
  InstallationTrigger,
  RecipeComposioTrigger,
  RecipeComposioTriggerCreateRequest,
  RecipeComposioTriggersResponse,
  RecipeConnectorProvider,
  RecipeWebhookTrigger,
  RecipeWebhookTriggerCreateRequest,
  RecipeWebhookTriggerSecret,
  RecipeWebhookTriggersResponse,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource } from "./resource.js";

function installationPath(installationId: string, suffix: string): string {
  return `/recipes/installations/${encodeURIComponent(installationId)}${suffix}`;
}

function triggerPath(installationId: string, triggerId: string, suffix = ""): string {
  return installationPath(installationId, `/triggers/${encodeURIComponent(triggerId)}${suffix}`);
}

function listInstallationTriggers(installationId: string): Promise<InstallationTrigger[]> {
  return resource<InstallationTrigger>(installationPath(installationId, "/triggers")).listAll();
}

function createInstallationTrigger<TResult>(
  installationId: string,
  request: CreateInstallationTriggerRequest,
): Promise<TResult> {
  return requestJson<TResult>(installationPath(installationId, "/triggers"), "POST", request);
}

export function updateInstallationTrigger<TResult>(
  installationId: string,
  triggerId: string,
  status: "active" | "paused",
): Promise<TResult> {
  return requestJson<TResult>(triggerPath(installationId, triggerId), "PATCH", { status });
}

export async function deleteInstallationTrigger(
  installationId: string,
  triggerId: string,
): Promise<void> {
  await requestJson<unknown>(triggerPath(installationId, triggerId), "DELETE");
}

export async function listRecipeComposioTriggerTypes(
  installationId: string,
  providerId: RecipeConnectorProvider,
): Promise<{ triggerTypes: ComposioTriggerType[] }> {
  return {
    triggerTypes: await resource<ComposioTriggerType>(
      installationPath(installationId, "/trigger_types"),
    ).listAll({ provider_id: providerId }),
  };
}

export async function listRecipeComposioTriggers(
  installationId: string,
): Promise<RecipeComposioTriggersResponse> {
  return {
    triggers: (await listInstallationTriggers(installationId)).flatMap((trigger) =>
      trigger.broker === "composio" ? [trigger] : [],
    ),
  };
}

export function createRecipeComposioTrigger(
  installationId: string,
  input: RecipeComposioTriggerCreateRequest,
): Promise<RecipeComposioTrigger> {
  return createInstallationTrigger(installationId, { ...input, broker: "composio" });
}

export async function listRecipeWebhookTriggers(
  installationId: string,
): Promise<RecipeWebhookTriggersResponse> {
  return {
    triggers: (await listInstallationTriggers(installationId)).flatMap((trigger) =>
      trigger.broker === "webhook" ? [trigger] : [],
    ),
  };
}

export function createRecipeWebhookTrigger(
  installationId: string,
  input: RecipeWebhookTriggerCreateRequest,
): Promise<RecipeWebhookTriggerSecret> {
  return createInstallationTrigger(installationId, { ...input, broker: "webhook" });
}

export function updateRecipeWebhookTriggerStatus(
  installationId: string,
  triggerId: string,
  status: "active" | "paused",
): Promise<RecipeWebhookTrigger> {
  return updateInstallationTrigger(installationId, triggerId, status);
}

export function rotateRecipeWebhookTrigger(
  installationId: string,
  triggerId: string,
): Promise<RecipeWebhookTriggerSecret> {
  return requestJson<RecipeWebhookTriggerSecret>(
    triggerPath(installationId, triggerId, "/rotate"),
    "POST",
    {},
  );
}
