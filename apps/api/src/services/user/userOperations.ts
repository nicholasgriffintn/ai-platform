import { KVCache } from "~/lib/cache";
import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  getUserConfigurableProviderMetadata,
  listConfigurableUserProviderIds,
} from "~/lib/providers/userConfigurableProviders";
import { validatePetSettingsUpdate } from "~/services/pets/settings";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/user/operations" });

let userCache: KVCache | null = null;

function getUserCache(env: any): KVCache | null {
  if (!env?.CACHE) {
    return null;
  }

  if (!userCache) {
    userCache = new KVCache(env.CACHE);
  }

  return userCache;
}

const ensureRepo = (context: ServiceContext) => {
  context.ensureDatabase();

  return context.repositories.userSettings;
};

async function invalidateUserModelCache(
  context: ServiceContext,
  userId: number,
  operation: string,
  providerId?: string,
): Promise<void> {
  const cache = getUserCache(context.env);

  if (!cache) {
    return;
  }

  const invalidated = await cache.clearUserModelCache(userId.toString());

  if (invalidated) {
    return;
  }

  logger.error("Failed to invalidate user model access cache", {
    userId,
    providerId,
    operation,
  });

  throw new AssistantError(
    "The change was saved, but model access could not be refreshed",
    ErrorType.INTERNAL_ERROR,
  );
}

export async function updateUserSettings(
  context: ServiceContext,
  settings: any,
  userId?: number,
): Promise<{ success: boolean; message: string }> {
  const repo = ensureRepo(context);
  const id = userId ?? context.requireUser().id;
  const validatedSettings = await validatePetSettingsUpdate(context, id, settings);

  await repo.updateUserSettings(id, validatedSettings);
  await invalidateUserModelCache(context, id, "update-user-settings");

  return {
    success: true,
    message: "User settings updated successfully",
  };
}

export async function getUserEnabledModels(
  context: ServiceContext,
  userId?: number,
): Promise<string[]> {
  const repo = ensureRepo(context);
  const id = userId ?? context.requireUser().id;
  const models = await repo.getUserEnabledModels(id);

  return models.map((model: any) => model.model_id || model);
}

export async function storeProviderApiKey(
  context: ServiceContext,
  providerId: string,
  apiKey: string,
  secretKey?: string,
  configuration?: Record<string, unknown>,
  userId?: number,
): Promise<{ success: boolean; message: string }> {
  const repo = ensureRepo(context);
  const id = userId ?? context.requireUser().id;

  await repo.storeProviderApiKey(id, providerId, apiKey, secretKey, configuration);
  await invalidateUserModelCache(context, id, "store-provider-api-key", providerId);

  return {
    success: true,
    message: "Provider API key stored successfully",
  };
}

export async function deleteProviderApiKey(
  context: ServiceContext,
  providerId: string,
  userId?: number,
): Promise<{ success: boolean; message: string }> {
  const repo = ensureRepo(context);
  const id = userId ?? context.requireUser().id;

  await repo.deleteProviderApiKey(id, providerId);
  await invalidateUserModelCache(context, id, "delete-provider-api-key", providerId);

  return {
    success: true,
    message: "Provider API key deleted successfully",
  };
}

export async function getUserProviderSettings(
  context: ServiceContext,
  userId?: number,
): Promise<any[]> {
  const repo = ensureRepo(context);
  const id = userId ?? context.requireUser().id;

  const settings = await repo.getUserProviderSettings(id);

  return settings.map((setting) => {
    const metadata = getUserConfigurableProviderMetadata(setting.provider_id as string);

    return {
      ...setting,
      type: metadata.type,
      name: metadata.name,
      description: metadata.description,
      configurationFields: metadata.configurationFields,
    };
  });
}

export async function getUserProviderSyncStatus(context: ServiceContext, userId?: number) {
  const repo = ensureRepo(context);
  const id = userId ?? context.requireUser().id;

  return repo.getProviderSyncStatus(id, listConfigurableUserProviderIds());
}

export async function syncUserProviders(
  context: ServiceContext,
  userId?: number,
): Promise<{ success: boolean; message: string }> {
  const repo = ensureRepo(context);
  const id = userId ?? context.requireUser().id;

  await repo.createUserProviderSettings(id, listConfigurableUserProviderIds());
  await invalidateUserModelCache(context, id, "sync-user-providers");

  return {
    success: true,
    message: "Providers synced successfully",
  };
}
