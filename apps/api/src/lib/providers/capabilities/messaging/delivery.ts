import type { IEnv, IUser } from "~/types";
import { getBooleanRecordValue, getStringRecordValue } from "~/utils/objects";
import { providerLibrary } from "../../library";
import { isMessagingProviderId } from "./metadata";
import { parseMessagingCredentialEnvelope } from "./credentials";
import type { MessagingProvider, MessagingProviderId } from "./types";

export function selectConfiguredMessagingProviderId(
	settings: Record<string, unknown>[],
): MessagingProviderId | null {
	for (const setting of settings) {
		const providerId = getStringRecordValue(setting, "provider_id");
		if (
			providerId &&
			isMessagingProviderId(providerId) &&
			getStringRecordValue(setting, "type") === "messaging" &&
			getBooleanRecordValue(setting, "enabled") === true &&
			getBooleanRecordValue(setting, "hasApiKey") === true
		) {
			return providerId;
		}
	}

	return null;
}

export function getMessagingProviderFromStoredCredential(params: {
	providerId: MessagingProviderId;
	value: string;
	env: IEnv;
	user: IUser;
}): MessagingProvider {
	const envelope = parseMessagingCredentialEnvelope({
		providerId: params.providerId,
		value: params.value,
	});

	return providerLibrary.messaging(params.providerId, {
		env: params.env,
		user: params.user,
		config: envelope.credentials,
	});
}
