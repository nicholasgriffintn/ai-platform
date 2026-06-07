import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getStringRecordValue } from "~/utils/objects";
import { isMessagingProviderId } from "./metadata";
import type {
	AwsSmsCredentials,
	MessagingProviderCredentials,
	MessagingProviderId,
	TwilioSmsCredentials,
} from "./types";

export interface MessagingCredentialEnvelope {
	version: 1;
	providerId: MessagingProviderId;
	credentials: MessagingProviderCredentials;
}

export function createMessagingCredentialEnvelope(params: {
	providerId: string;
	apiKey: string;
	secretKey?: string | null;
	configuration?: Record<string, unknown>;
}): MessagingCredentialEnvelope {
	if (!isMessagingProviderId(params.providerId)) {
		throw new AssistantError("Unknown messaging provider", ErrorType.PARAMS_ERROR);
	}

	const config = params.configuration ?? {};
	if (params.providerId === "twilio-sms") {
		const accountSid = params.apiKey.trim();
		const authToken = params.secretKey?.trim() || getStringRecordValue(config, "authToken");
		const fromNumber = getStringRecordValue(config, "fromNumber");
		const messagingServiceSid = getStringRecordValue(config, "messagingServiceSid");

		if (!accountSid || !authToken) {
			throw new AssistantError("Twilio SMS credentials are incomplete", ErrorType.PARAMS_ERROR);
		}
		if (!fromNumber && !messagingServiceSid) {
			throw new AssistantError(
				"Twilio SMS requires a From phone number or Messaging Service SID",
				ErrorType.PARAMS_ERROR,
			);
		}

		return {
			version: 1,
			providerId: params.providerId,
			credentials: {
				accountSid,
				authToken,
				fromNumber,
				messagingServiceSid,
			},
		};
	}

	if (params.providerId === "aws-sms") {
		const accessKeyId = params.apiKey.trim();
		const secretAccessKey =
			params.secretKey?.trim() || getStringRecordValue(config, "secretAccessKey");
		const region = getStringRecordValue(config, "region");
		const senderId = getStringRecordValue(config, "senderId");

		if (!accessKeyId || !secretAccessKey || !region) {
			throw new AssistantError("AWS SMS credentials are incomplete", ErrorType.PARAMS_ERROR);
		}

		return {
			version: 1,
			providerId: params.providerId,
			credentials: {
				accessKeyId,
				secretAccessKey,
				region,
				senderId,
			},
		};
	}

	throw new AssistantError("Unknown messaging provider", ErrorType.PARAMS_ERROR);
}

export function parseMessagingCredentialEnvelope(params: {
	providerId: string;
	value: string;
}): MessagingCredentialEnvelope {
	if (!isMessagingProviderId(params.providerId)) {
		throw new AssistantError("Unknown messaging provider", ErrorType.PARAMS_ERROR);
	}

	const parsed = safeParseJson<MessagingCredentialEnvelope>(params.value);
	if (
		!parsed ||
		parsed.version !== 1 ||
		parsed.providerId !== params.providerId ||
		!parsed.credentials ||
		typeof parsed.credentials !== "object"
	) {
		throw new AssistantError(
			"Messaging provider credentials must be reconfigured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return parsed;
}

export function isTwilioSmsCredentials(
	credentials: MessagingProviderCredentials,
): credentials is TwilioSmsCredentials {
	return "accountSid" in credentials && "authToken" in credentials;
}

export function isAwsSmsCredentials(
	credentials: MessagingProviderCredentials,
): credentials is AwsSmsCredentials {
	return (
		"accessKeyId" in credentials && "secretAccessKey" in credentials && "region" in credentials
	);
}
