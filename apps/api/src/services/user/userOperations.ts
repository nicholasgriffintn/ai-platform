import { KVCache } from "~/lib/cache";
import { Database } from "~/lib/database";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/user/operations" });

let userCache: KVCache | null = null;

function getUserCache(env: any): KVCache | null {
  if (!env.CACHE) return null;

  if (!userCache) {
    userCache = new KVCache(env.CACHE);
  }
  return userCache;
}

export async function updateUserSettings(
  env: IEnv,
  userId: number,
  settings: any,
): Promise<{ success: boolean; message: string }> {
  const database = Database.getInstance(env);
  await database.updateUserSettings(userId, settings);

  const cache = getUserCache(env);
  if (cache) {
    try {
      await cache.clearUserModelCache(userId.toString());
    } catch (error) {
      logger.error("Failed to clear user model cache after settings update", {
        userId,
        error,
      });
    }
  }

  return {
    success: true,
    message: "User settings updated successfully",
  };
}

export async function getUserEnabledModels(
  env: IEnv,
  userId: number,
): Promise<string[]> {
  const database = Database.getInstance(env);
  const models = await database.getUserEnabledModels(userId);
  return models.map((model: any) => model.model_id || model);
}

export async function storeProviderApiKey(
  env: IEnv,
  userId: number,
  providerId: string,
  apiKey: string,
  secretKey?: string,
): Promise<{ success: boolean; message: string }> {
  const database = Database.getInstance(env);
  await database.storeProviderApiKey(userId, providerId, apiKey, secretKey);

  const cache = getUserCache(env);
  if (cache) {
    try {
      await cache.clearUserModelCache(userId.toString());
    } catch (error) {
      logger.error(
        "Failed to clear user caches after provider API key update",
        {
          userId,
          providerId,
          error,
        },
      );
    }
  }

  return {
    success: true,
    message: "Provider API key stored successfully",
  };
}

export async function getUserProviderSettings(
  env: IEnv,
  userId: number,
): Promise<any[]> {
  const database = Database.getInstance(env);
  return await database.getUserProviderSettings(userId);
}

export async function syncUserProviders(
  env: IEnv,
  userId: number,
): Promise<{ success: boolean; message: string }> {
  const database = Database.getInstance(env);
  await database.createUserProviderSettings(userId);

  const cache = getUserCache(env);
  if (cache) {
    try {
      await cache.clearUserModelCache(userId.toString());
    } catch (error) {
      logger.error("Failed to clear user caches after provider sync", {
        userId,
        error,
      });
    }
  }

  return {
    success: true,
    message: "Providers synced successfully",
  };
}

export function validatePlanRequirement(
  user: IUser,
  requiredPlan: string,
): void {
  if (user.plan_id !== requiredPlan) {
    throw new AssistantError(
      `User is not on ${requiredPlan} plan`,
      ErrorType.AUTHORISATION_ERROR,
    );
  }
}
