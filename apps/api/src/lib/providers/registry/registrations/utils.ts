import type { ProviderFactoryContext } from "../types";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export function ensureEnv(context: ProviderFactoryContext): IEnv {
	if (!context.env) {
		throw new AssistantError(
			"Provider resolution requires an env context",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return context.env;
}

export function ensureUser(
	context: ProviderFactoryContext,
	options?: { optional?: boolean },
): IUser | undefined {
	if (!context.user && !options?.optional) {
		throw new AssistantError(
			"Provider resolution requires a user context",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return context.user;
}

export function ensureConfig<TConfig = Record<string, unknown>>(
	context: ProviderFactoryContext,
	message?: string,
): TConfig {
	if (!context.config) {
		throw new AssistantError(
			message || "Provider resolution requires configuration",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return context.config as TConfig;
}
