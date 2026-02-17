import { KVCache } from "~/lib/cache";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/user/operations" });

let userCache: KVCache | null = null;

function getUserCache(env: any): KVCache | null {
	if (!env?.CACHE) return null;

	if (!userCache) {
		userCache = new KVCache(env.CACHE);
	}
	return userCache;
}

const ensureRepo = (context: ServiceContext) => {
	context.ensureDatabase();
	return context.repositories.userSettings;
};

export async function updateUserSettings(
	context: ServiceContext,
	settings: any,
	userId?: number,
): Promise<{ success: boolean; message: string }> {
	const repo = ensureRepo(context);
	const id = userId ?? context.requireUser().id;
	await repo.updateUserSettings(id, settings);

	const cache = getUserCache(context.env);
	if (cache) {
		try {
			await cache.clearUserModelCache(id.toString());
		} catch (error) {
			logger.error("Failed to clear user model cache after settings update", {
				userId: id,
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
	userId?: number,
): Promise<{ success: boolean; message: string }> {
	const repo = ensureRepo(context);
	const id = userId ?? context.requireUser().id;
	await repo.storeProviderApiKey(id, providerId, apiKey, secretKey);

	const cache = getUserCache(context.env);
	if (cache) {
		try {
			await cache.clearUserModelCache(id.toString());
		} catch (error) {
			logger.error(
				"Failed to clear user caches after provider API key update",
				{
					userId: id,
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
	context: ServiceContext,
	userId?: number,
): Promise<any[]> {
	const repo = ensureRepo(context);
	const id = userId ?? context.requireUser().id;
	return repo.getUserProviderSettings(id);
}

export async function syncUserProviders(
	context: ServiceContext,
	userId?: number,
): Promise<{ success: boolean; message: string }> {
	const repo = ensureRepo(context);
	const id = userId ?? context.requireUser().id;
	await repo.createUserProviderSettings(id);

	const cache = getUserCache(context.env);
	if (cache) {
		try {
			await cache.clearUserModelCache(id.toString());
		} catch (error) {
			logger.error("Failed to clear user caches after provider sync", {
				userId: id,
				error,
			});
		}
	}

	return {
		success: true,
		message: "Providers synced successfully",
	};
}
