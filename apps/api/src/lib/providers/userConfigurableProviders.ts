import { listConfigurableChatProviders } from "~/lib/providers/capabilities/chat";
import {
	getMessagingProviderMetadata,
	isMessagingProviderId,
	listConfigurableMessagingProviders,
} from "~/lib/providers/capabilities/messaging";

export interface UserConfigurableProvider {
	id: string;
	name: string;
	type: "chat" | "messaging";
	description?: string;
	configurationFields?: Array<{
		key: string;
		label: string;
		type: "text" | "password";
		required?: boolean;
		placeholder?: string;
		description?: string;
	}>;
}

export function listConfigurableUserProviderIds(): string[] {
	return Array.from(
		new Set([...listConfigurableChatProviders(), ...listConfigurableMessagingProviders()]),
	).sort();
}

export function getUserConfigurableProviderMetadata(providerId: string): UserConfigurableProvider {
	if (isMessagingProviderId(providerId)) {
		const metadata = getMessagingProviderMetadata(providerId);
		if (metadata) {
			return {
				id: metadata.id,
				name: metadata.name,
				type: "messaging",
				description: metadata.description,
				configurationFields: metadata.configurationFields,
			};
		}
	}

	return {
		id: providerId,
		name: providerId,
		type: "chat",
	};
}
