import type { IEnv, IUser } from "~/types";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { getAssetIdFromUrl } from "~/lib/storage/asset-urls";
import { parseFirstPartyQrPngUrl } from "~/utils/qr";
import { getBooleanRecordValue, getStringRecordValue, isRecord } from "~/utils/objects";
import { providerLibrary } from "../../library";
import { isMessagingProviderId } from "./metadata";
import { parseMessagingCredentialEnvelope } from "./credentials";
import type { MessagingProvider, MessagingProviderId } from "./types";

export interface ConfiguredMessagingProviderSettings {
	id: string;
	providerId: MessagingProviderId;
}

export interface ConfiguredMessagingDelivery extends ConfiguredMessagingProviderSettings {
	mediaUrls?: string[];
}

function isConfiguredMessagingProviderSetting(setting: Record<string, unknown>) {
	const id = getStringRecordValue(setting, "id");
	const providerId = getStringRecordValue(setting, "provider_id");
	if (
		id &&
		providerId &&
		isMessagingProviderId(providerId) &&
		getStringRecordValue(setting, "type") === "messaging" &&
		getBooleanRecordValue(setting, "enabled") === true &&
		getBooleanRecordValue(setting, "hasApiKey") === true
	) {
		return { id, providerId };
	}

	return null;
}

function getProviderConfigurationValues(setting: Record<string, unknown>): Record<string, unknown> {
	const configurationValues = setting.configurationValues;
	return isRecord(configurationValues) ? configurationValues : {};
}

function normaliseMessagingMediaUrlsForProvider(
	setting: Record<string, unknown>,
	providerId: MessagingProviderId,
	options: {
		mediaUrls?: string[];
		apiBaseUrl?: string;
	},
): string[] | null {
	const urls = (options.mediaUrls ?? []).map((url) => url.trim()).filter(Boolean);
	if (urls.length === 0) {
		return [];
	}

	if (providerId === "twilio-sms") {
		return urls.every((url) => url.startsWith("https://")) ? urls : null;
	}

	if (providerId !== "aws-sms") {
		return null;
	}

	const s3MediaUrl = urls.find((url) => url.startsWith("s3://"));
	if (s3MediaUrl) {
		return [s3MediaUrl];
	}

	const configurationValues = getProviderConfigurationValues(setting);
	if (!getStringRecordValue(configurationValues, "mediaBucket")) {
		return null;
	}

	const firstPartyMediaUrl = urls.find(
		(url) =>
			url.startsWith("https://") && typeof getAssetIdFromUrl(url, options.apiBaseUrl) === "string",
	);
	if (firstPartyMediaUrl) {
		return [firstPartyMediaUrl];
	}

	const firstPartyQrMediaUrl = urls.find((url) =>
		Boolean(parseFirstPartyQrPngUrl(url, options.apiBaseUrl)),
	);
	return firstPartyQrMediaUrl ? [firstPartyQrMediaUrl] : null;
}

export function selectConfiguredMessagingDelivery(
	settings: Record<string, unknown>[],
	options: { mediaUrls?: string[]; apiBaseUrl?: string } = {},
): ConfiguredMessagingDelivery | null {
	for (const setting of settings) {
		const provider = isConfiguredMessagingProviderSetting(setting);
		if (!provider) {
			continue;
		}

		const mediaUrls = normaliseMessagingMediaUrlsForProvider(setting, provider.providerId, options);
		if (mediaUrls) {
			return {
				...provider,
				...(mediaUrls.length ? { mediaUrls } : {}),
			};
		}
	}

	return null;
}

export function selectConfiguredMessagingProviderSettings(
	settings: Record<string, unknown>[],
	options: { mediaUrls?: string[]; apiBaseUrl?: string } = {},
): ConfiguredMessagingProviderSettings | null {
	const delivery = selectConfiguredMessagingDelivery(settings, options);
	return delivery ? { id: delivery.id, providerId: delivery.providerId } : null;
}

export function getMessagingProviderFromStoredCredential(params: {
	providerId: MessagingProviderId;
	value: string;
	env: IEnv;
	user: IUser;
	context?: ServiceContext;
}): MessagingProvider {
	const envelope = parseMessagingCredentialEnvelope({
		providerId: params.providerId,
		value: params.value,
	});

	return providerLibrary.messaging(params.providerId, {
		env: params.env,
		user: params.user,
		serviceContext: params.context,
		config: envelope.credentials,
	});
}
