import type { RecipeInstallationTrigger } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	selectConfiguredMessagingProviderSettings,
	type ConfiguredMessagingProviderSettings,
} from "~/lib/providers/capabilities/messaging/delivery";

interface RecipeNotificationCapabilityParams {
	context?: ServiceContext;
	userId?: number;
	apiBaseUrl?: string;
}

export interface RecipeNotificationCapabilities {
	sms: {
		available: boolean;
		configuredProviders: ConfiguredMessagingProviderSettings["providerId"][];
		guidance: string;
	};
}

export async function getRecipeNotificationCapabilities({
	context,
	userId,
	apiBaseUrl,
}: RecipeNotificationCapabilityParams): Promise<RecipeNotificationCapabilities> {
	if (!context?.repositories?.userSettings || !userId) {
		return {
			sms: {
				available: false,
				configuredProviders: [],
				guidance:
					"SMS notification availability is unknown. Do not save SMS notification triggers unless the user connects SMS first.",
			},
		};
	}

	const provider = selectConfiguredMessagingProviderSettings(
		await context.repositories.userSettings.getUserProviderSettings(userId),
		{ apiBaseUrl },
	);

	return {
		sms: {
			available: Boolean(provider),
			configuredProviders: provider ? [provider.providerId] : [],
			guidance: provider
				? "SMS notifications are available. Only save SMS notification triggers when the user explicitly asks for SMS or confirms SMS delivery."
				: 'SMS notifications are not configured. Do not set notificationChannel: "sms" or notificationTarget; save scheduled/manual chat-only triggers instead, or ask the user to connect SMS first.',
		},
	};
}

export function hasSmsNotificationTrigger(
	triggers: Pick<RecipeInstallationTrigger, "notificationChannel">[] | undefined,
): boolean {
	return triggers?.some((trigger) => trigger.notificationChannel === "sms") ?? false;
}
