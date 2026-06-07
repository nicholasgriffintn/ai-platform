import { listConfigurableChatProviders } from "~/lib/providers/capabilities/chat";

export interface UserConfigurableProvider {
	id: string;
	name: string;
	type: "chat";
	description?: string;
}

export function listConfigurableUserProviderIds(): string[] {
	return Array.from(new Set(listConfigurableChatProviders())).sort();
}

export function getUserConfigurableProviderMetadata(providerId: string): UserConfigurableProvider {
	return {
		id: providerId,
		name: providerId,
		type: "chat",
	};
}
