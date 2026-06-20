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

function isValidAwsS3BucketName(bucket: string): boolean {
	return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) && !bucket.includes("..");
}

function normaliseAwsS3KeyPrefix(prefix: string | undefined): string | undefined {
	if (!prefix) {
		return undefined;
	}

	const normalised = prefix.trim().replace(/^\/+|\/+$/g, "");
	if (!normalised) {
		return undefined;
	}
	if (normalised.includes("..") || normalised.includes("\\")) {
		throw new AssistantError("AWS MMS media key prefix is invalid", ErrorType.PARAMS_ERROR);
	}

	return normalised;
}

function normaliseAwsContext(value: string | undefined): Record<string, string> | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = safeParseJson<Record<string, unknown>>(value);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new AssistantError(
			"AWS End User Messaging context must be a JSON object",
			ErrorType.PARAMS_ERROR,
		);
	}

	const entries = Object.entries(parsed).map(([key, entryValue]) => [
		key.trim(),
		typeof entryValue === "string" ? entryValue.trim() : String(entryValue).trim(),
	]);
	if (entries.length > 5) {
		throw new AssistantError(
			"AWS End User Messaging context supports at most five entries",
			ErrorType.PARAMS_ERROR,
		);
	}
	for (const [key, entryValue] of entries) {
		if (!key || /\s/.test(key) || key.length > 100 || !entryValue || entryValue.length > 800) {
			throw new AssistantError(
				"AWS End User Messaging context keys and values are invalid",
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normaliseOptionalBoolean(value: string | undefined, label: string): boolean | undefined {
	if (!value) {
		return undefined;
	}

	const normalised = value.toLowerCase();
	if (normalised === "true") {
		return true;
	}
	if (normalised === "false") {
		return false;
	}

	throw new AssistantError(`${label} must be true or false`, ErrorType.PARAMS_ERROR);
}

function normaliseAwsTimeToLive(value: string | undefined): number | undefined {
	if (!value) {
		return undefined;
	}

	if (!/^\d+$/.test(value)) {
		throw new AssistantError(
			"AWS End User Messaging TTL must be an integer",
			ErrorType.PARAMS_ERROR,
		);
	}

	const timeToLive = Number(value);
	if (!Number.isSafeInteger(timeToLive) || timeToLive < 5 || timeToLive > 259200) {
		throw new AssistantError(
			"AWS End User Messaging TTL must be between 5 and 259200 seconds",
			ErrorType.PARAMS_ERROR,
		);
	}

	return timeToLive;
}

function normaliseAwsDestinationCountryParameters(params: {
	indiaEntityId?: string;
	indiaTemplateId?: string;
}): Partial<Record<"IN_ENTITY_ID" | "IN_TEMPLATE_ID", string>> | undefined {
	const destinationCountryParameters = {
		...(params.indiaEntityId ? { IN_ENTITY_ID: params.indiaEntityId } : {}),
		...(params.indiaTemplateId ? { IN_TEMPLATE_ID: params.indiaTemplateId } : {}),
	};

	return Object.keys(destinationCountryParameters).length > 0
		? destinationCountryParameters
		: undefined;
}

export function createMessagingCredentialEnvelope(params: {
	providerId: string;
	apiKey?: string | null;
	secretKey?: string | null;
	configuration?: Record<string, unknown>;
	existingCredentials?: MessagingProviderCredentials | null;
}): MessagingCredentialEnvelope {
	if (!isMessagingProviderId(params.providerId)) {
		throw new AssistantError("Unknown messaging provider", ErrorType.PARAMS_ERROR);
	}

	const config = params.configuration ?? {};
	if (params.providerId === "twilio-sms") {
		const existing =
			params.existingCredentials && isTwilioSmsCredentials(params.existingCredentials)
				? params.existingCredentials
				: undefined;
		const accountSid =
			params.apiKey?.trim() || getStringRecordValue(config, "accountSid") || existing?.accountSid;
		const authToken =
			params.secretKey?.trim() || getStringRecordValue(config, "authToken") || existing?.authToken;
		const fromNumber = getOptionalStringRecordValue(config, "fromNumber", existing?.fromNumber);
		const messagingServiceSid = getOptionalStringRecordValue(
			config,
			"messagingServiceSid",
			existing?.messagingServiceSid,
		);

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
		const existing =
			params.existingCredentials && isAwsSmsCredentials(params.existingCredentials)
				? params.existingCredentials
				: undefined;
		const accessKeyId =
			params.apiKey?.trim() || getStringRecordValue(config, "accessKeyId") || existing?.accessKeyId;
		const secretAccessKey =
			params.secretKey?.trim() ||
			getStringRecordValue(config, "secretAccessKey") ||
			existing?.secretAccessKey;
		const region = getOptionalStringRecordValue(config, "region", existing?.region);
		const originationIdentity = getOptionalStringRecordValue(
			config,
			"originationIdentity",
			existing?.originationIdentity,
		);
		const configurationSetName = getOptionalStringRecordValue(
			config,
			"configurationSetName",
			existing?.configurationSetName,
		);
		const context = normaliseAwsContext(
			getOptionalStringRecordValue(
				config,
				"context",
				existing?.context ? JSON.stringify(existing.context) : undefined,
			),
		);
		const messageFeedbackEnabled = normaliseOptionalBoolean(
			getOptionalStringRecordValue(
				config,
				"messageFeedbackEnabled",
				existing?.messageFeedbackEnabled === undefined
					? undefined
					: String(existing.messageFeedbackEnabled),
			),
			"AWS End User Messaging message feedback",
		);
		const timeToLive = normaliseAwsTimeToLive(
			getOptionalStringRecordValue(
				config,
				"timeToLive",
				existing?.timeToLive === undefined ? undefined : String(existing.timeToLive),
			),
		);
		const dryRun = normaliseOptionalBoolean(
			getOptionalStringRecordValue(
				config,
				"dryRun",
				existing?.dryRun === undefined ? undefined : String(existing.dryRun),
			),
			"AWS End User Messaging dry run",
		);
		const rawMessageType = getOptionalStringRecordValue(
			config,
			"messageType",
			existing?.messageType,
		)?.toUpperCase();
		const maxPrice = getOptionalStringRecordValue(config, "maxPrice", existing?.maxPrice);
		const keyword = getOptionalStringRecordValue(config, "keyword", existing?.keyword);
		const protectConfigurationId = getOptionalStringRecordValue(
			config,
			"protectConfigurationId",
			existing?.protectConfigurationId,
		);
		const destinationCountryParameters = normaliseAwsDestinationCountryParameters({
			indiaEntityId: getOptionalStringRecordValue(
				config,
				"indiaEntityId",
				existing?.destinationCountryParameters?.IN_ENTITY_ID,
			),
			indiaTemplateId: getOptionalStringRecordValue(
				config,
				"indiaTemplateId",
				existing?.destinationCountryParameters?.IN_TEMPLATE_ID,
			),
		});
		const mediaBucket = getOptionalStringRecordValue(config, "mediaBucket", existing?.mediaBucket);
		const mediaKeyPrefix = normaliseAwsS3KeyPrefix(
			getOptionalStringRecordValue(config, "mediaKeyPrefix", existing?.mediaKeyPrefix),
		);

		if (!accessKeyId || !secretAccessKey || !region || !originationIdentity) {
			throw new AssistantError("AWS SMS credentials are incomplete", ErrorType.PARAMS_ERROR);
		}
		if (mediaBucket && !isValidAwsS3BucketName(mediaBucket)) {
			throw new AssistantError("AWS MMS media bucket is invalid", ErrorType.PARAMS_ERROR);
		}
		let messageType: "TRANSACTIONAL" | "PROMOTIONAL" | undefined;
		if (rawMessageType === "TRANSACTIONAL" || rawMessageType === "PROMOTIONAL") {
			messageType = rawMessageType;
		} else if (rawMessageType) {
			throw new AssistantError(
				"AWS End User Messaging message type must be TRANSACTIONAL or PROMOTIONAL",
				ErrorType.PARAMS_ERROR,
			);
		}

		return {
			version: 1,
			providerId: params.providerId,
			credentials: {
				accessKeyId,
				secretAccessKey,
				region,
				originationIdentity,
				configurationSetName,
				context,
				destinationCountryParameters,
				dryRun,
				messageFeedbackEnabled,
				messageType,
				maxPrice,
				keyword,
				protectConfigurationId,
				timeToLive,
				mediaBucket,
				mediaKeyPrefix,
			},
		};
	}

	throw new AssistantError("Unknown messaging provider", ErrorType.PARAMS_ERROR);
}

function getOptionalStringRecordValue(
	value: Record<string, unknown>,
	key: string,
	fallback?: string,
): string | undefined {
	if (!Object.hasOwn(value, key)) {
		return fallback;
	}

	return getStringRecordValue(value, key);
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
		"accessKeyId" in credentials &&
		typeof credentials.accessKeyId === "string" &&
		credentials.accessKeyId.trim().length > 0 &&
		"secretAccessKey" in credentials &&
		typeof credentials.secretAccessKey === "string" &&
		credentials.secretAccessKey.trim().length > 0 &&
		"region" in credentials &&
		typeof credentials.region === "string" &&
		credentials.region.trim().length > 0 &&
		"originationIdentity" in credentials &&
		typeof credentials.originationIdentity === "string" &&
		credentials.originationIdentity.trim().length > 0
	);
}

export function getMessagingCredentialConfigurationValues(
	credentials: MessagingProviderCredentials,
): Record<string, string> {
	if (isTwilioSmsCredentials(credentials)) {
		return {
			...(credentials.fromNumber ? { fromNumber: credentials.fromNumber } : {}),
			...(credentials.messagingServiceSid
				? { messagingServiceSid: credentials.messagingServiceSid }
				: {}),
		};
	}

	if (isAwsSmsCredentials(credentials)) {
		return {
			region: credentials.region,
			originationIdentity: credentials.originationIdentity,
			...(credentials.configurationSetName
				? { configurationSetName: credentials.configurationSetName }
				: {}),
			...(credentials.context ? { context: JSON.stringify(credentials.context) } : {}),
			...(credentials.messageFeedbackEnabled === undefined
				? {}
				: { messageFeedbackEnabled: String(credentials.messageFeedbackEnabled) }),
			...(credentials.timeToLive === undefined
				? {}
				: { timeToLive: String(credentials.timeToLive) }),
			...(credentials.dryRun === undefined ? {} : { dryRun: String(credentials.dryRun) }),
			...(credentials.messageType ? { messageType: credentials.messageType } : {}),
			...(credentials.maxPrice ? { maxPrice: credentials.maxPrice } : {}),
			...(credentials.keyword ? { keyword: credentials.keyword } : {}),
			...(credentials.destinationCountryParameters?.IN_ENTITY_ID
				? { indiaEntityId: credentials.destinationCountryParameters.IN_ENTITY_ID }
				: {}),
			...(credentials.destinationCountryParameters?.IN_TEMPLATE_ID
				? { indiaTemplateId: credentials.destinationCountryParameters.IN_TEMPLATE_ID }
				: {}),
			...(credentials.protectConfigurationId
				? { protectConfigurationId: credentials.protectConfigurationId }
				: {}),
			...(credentials.mediaBucket ? { mediaBucket: credentials.mediaBucket } : {}),
			...(credentials.mediaKeyPrefix ? { mediaKeyPrefix: credentials.mediaKeyPrefix } : {}),
		};
	}

	return {};
}
