import type { IEnv, IUser } from "~/types";
import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export type RealtimeSessionType = "transcription";
export type RealtimeTranscriptionDelay = "minimal" | "low" | "medium" | "high" | "xhigh";

export interface RealtimeSessionRequest {
	env: IEnv;
	user: IUser;
	type: RealtimeSessionType;
	model?: string;
	language?: string;
	delay?: RealtimeTranscriptionDelay;
}

export interface RealtimeProvider {
	name: string;
	models?: string[];
	createSession(request: RealtimeSessionRequest): Promise<unknown>;
}

/**
 * Resolve a realtime provider from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getRealtimeProvider(
	providerName: string,
	context?: ProviderFactoryContext,
): RealtimeProvider {
	return providerLibrary.realtime(providerName, context);
}

/**
 * List all registered realtime providers (includes aliases).
 */
export function listRealtimeProviders(): string[] {
	const summaries = providerLibrary.list("realtime");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
