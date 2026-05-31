import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

interface ProviderApiKeyLogger {
	error(message: string, metadata?: Record<string, unknown>): void;
}

interface ResolveProviderApiKeyOptions {
	env: IEnv;
	providerName: string;
	envKeyName: string;
	userId?: number;
	logger?: ProviderApiKeyLogger;
}

interface HasUserProviderApiKeyOptions {
	env: IEnv;
	user?: Pick<IUser, "id">;
	providerName: string;
}

export async function hasUserProviderApiKey({
	env,
	user,
	providerName,
}: HasUserProviderApiKeyOptions): Promise<boolean> {
	if (!user?.id || !env.DB || !providerName.trim()) {
		return false;
	}

	const userSettingsRepo = new UserSettingsRepository(env);
	return userSettingsRepo.hasProviderApiKey(user.id, providerName);
}

export async function resolveProviderApiKey({
	env,
	providerName,
	envKeyName,
	userId,
	logger,
}: ResolveProviderApiKeyOptions): Promise<string> {
	if (userId && env.DB) {
		const userSettingsRepo = new UserSettingsRepository(env);
		try {
			const apiKey = await userSettingsRepo.getProviderApiKey(userId, providerName);
			if (apiKey) {
				return apiKey;
			}
		} catch (error) {
			if (
				!(
					error instanceof AssistantError &&
					(error.type === ErrorType.NOT_FOUND || error.type === ErrorType.PARAMS_ERROR)
				)
			) {
				logger?.error(`Failed to get user API key for ${providerName}:`, { error });
			}
		}
	}

	const envValue = (env as Record<string, unknown>)[envKeyName];
	if (typeof envValue !== "string" || envValue.length === 0) {
		throw new AssistantError(`Missing ${envKeyName}`, ErrorType.CONFIGURATION_ERROR);
	}

	return envValue;
}
