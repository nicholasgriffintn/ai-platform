import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";
import { ensureConfig } from "../../registry/registrations/utils";
import type { MessagingProvider, MessagingProviderCredentials, MessagingProviderId } from "./types";

export * from "./credentials";
export * from "./metadata";
export * from "./providers";
export type * from "./types";

export function getMessagingProvider(
	providerName: MessagingProviderId,
	context?: ProviderFactoryContext,
): MessagingProvider {
	return providerLibrary.messaging(providerName, context);
}

export function ensureMessagingCredentials(context: ProviderFactoryContext) {
	return ensureConfig<MessagingProviderCredentials>(
		context,
		"Messaging provider resolution requires credentials",
	);
}
