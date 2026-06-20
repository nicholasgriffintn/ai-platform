import { describe, expect, it } from "vitest";

import {
	createMessagingCredentialEnvelope,
	getMessagingCredentialConfigurationValues,
	parseMessagingCredentialEnvelope,
} from "../credentials";
import {
	selectConfiguredMessagingDelivery,
	selectConfiguredMessagingProviderSettings,
} from "../delivery";

describe("messaging credentials", () => {
	it("normalises Twilio credentials into a typed envelope", () => {
		const envelope = createMessagingCredentialEnvelope({
			providerId: "twilio-sms",
			apiKey: " AC123 ",
			secretKey: " token ",
			configuration: {
				fromNumber: " +15557654321 ",
			},
		});

		expect(envelope).toEqual({
			version: 1,
			providerId: "twilio-sms",
			credentials: {
				accountSid: "AC123",
				authToken: "token",
				fromNumber: "+15557654321",
				messagingServiceSid: undefined,
			},
		});
	});

	it("rejects Twilio credentials without a sender", () => {
		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "twilio-sms",
				apiKey: "AC123",
				secretKey: "token",
			}),
		).toThrow("From phone number or Messaging Service SID");
	});

	it("normalises AWS SMS credentials into a typed envelope", () => {
		const envelope = createMessagingCredentialEnvelope({
			providerId: "aws-sms",
			apiKey: " AKIA123 ",
			secretKey: " secret ",
			configuration: {
				region: " eu-west-2 ",
				originationIdentity: " pool-abc123 ",
				configurationSetName: " polychat-events ",
				context: '{"app":"polychat","channel":"sms"}',
				messageFeedbackEnabled: "true",
				timeToLive: "900",
				dryRun: "false",
				messageType: " promotional ",
				maxPrice: "0.05",
				keyword: " WEATHER ",
				indiaEntityId: " entity-1 ",
				indiaTemplateId: " template-1 ",
				mediaBucket: " polychat-mms-media ",
				mediaKeyPrefix: " generated/media ",
			},
		});

		expect(envelope).toEqual({
			version: 1,
			providerId: "aws-sms",
			credentials: {
				accessKeyId: "AKIA123",
				secretAccessKey: "secret",
				region: "eu-west-2",
				originationIdentity: "pool-abc123",
				configurationSetName: "polychat-events",
				context: { app: "polychat", channel: "sms" },
				destinationCountryParameters: {
					IN_ENTITY_ID: "entity-1",
					IN_TEMPLATE_ID: "template-1",
				},
				dryRun: false,
				messageFeedbackEnabled: true,
				messageType: "PROMOTIONAL",
				maxPrice: "0.05",
				keyword: "WEATHER",
				protectConfigurationId: undefined,
				timeToLive: 900,
				mediaBucket: "polychat-mms-media",
				mediaKeyPrefix: "generated/media",
			},
		});
	});

	it("preserves existing messaging secrets when only configuration changes", () => {
		const envelope = createMessagingCredentialEnvelope({
			providerId: "aws-sms",
			apiKey: "",
			configuration: {
				region: "us-east-1",
				originationIdentity: "pool-updated",
				configurationSetName: "",
				context: "",
				messageFeedbackEnabled: "",
				timeToLive: "",
				dryRun: "",
				messageType: "transactional",
				indiaEntityId: "",
				indiaTemplateId: "",
			},
			existingCredentials: {
				accessKeyId: "AKIA123",
				secretAccessKey: "secret",
				region: "eu-west-2",
				originationIdentity: "pool-original",
				configurationSetName: "old-set",
				context: { old: "context" },
				destinationCountryParameters: {
					IN_ENTITY_ID: "old-entity",
					IN_TEMPLATE_ID: "old-template",
				},
				dryRun: true,
				messageFeedbackEnabled: true,
				messageType: "PROMOTIONAL",
				timeToLive: 120,
			},
		});

		expect(envelope.credentials).toEqual({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "us-east-1",
			originationIdentity: "pool-updated",
			configurationSetName: undefined,
			context: undefined,
			destinationCountryParameters: undefined,
			dryRun: undefined,
			messageFeedbackEnabled: undefined,
			messageType: "TRANSACTIONAL",
			maxPrice: undefined,
			keyword: undefined,
			protectConfigurationId: undefined,
			timeToLive: undefined,
			mediaBucket: undefined,
			mediaKeyPrefix: undefined,
		});
	});

	it("exposes only non-secret messaging configuration values", () => {
		expect(
			getMessagingCredentialConfigurationValues({
				accessKeyId: "AKIA123",
				secretAccessKey: "secret",
				region: "eu-west-2",
				originationIdentity: "pool-abc123",
				configurationSetName: "polychat-events",
				context: { app: "polychat" },
				destinationCountryParameters: {
					IN_ENTITY_ID: "entity-1",
					IN_TEMPLATE_ID: "template-1",
				},
				dryRun: false,
				messageFeedbackEnabled: true,
				messageType: "TRANSACTIONAL",
				maxPrice: "0.05",
				keyword: "WEATHER",
				timeToLive: 900,
				mediaBucket: "polychat-mms-media",
				mediaKeyPrefix: "generated/media",
			}),
		).toEqual({
			region: "eu-west-2",
			originationIdentity: "pool-abc123",
			configurationSetName: "polychat-events",
			context: '{"app":"polychat"}',
			messageFeedbackEnabled: "true",
			timeToLive: "900",
			dryRun: "false",
			messageType: "TRANSACTIONAL",
			maxPrice: "0.05",
			keyword: "WEATHER",
			indiaEntityId: "entity-1",
			indiaTemplateId: "template-1",
			mediaBucket: "polychat-mms-media",
			mediaKeyPrefix: "generated/media",
		});

		expect(
			getMessagingCredentialConfigurationValues({
				accountSid: "AC123",
				authToken: "token",
				messagingServiceSid: "MG123",
			}),
		).toEqual({
			messagingServiceSid: "MG123",
		});
	});

	it("rejects invalid AWS MMS media bucket configuration", () => {
		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "aws-sms",
				apiKey: "AKIA123",
				secretKey: "secret",
				configuration: {
					region: "eu-west-2",
					originationIdentity: "pool-abc123",
					mediaBucket: "../not-a-bucket",
				},
			}),
		).toThrow("media bucket");

		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "aws-sms",
				apiKey: "AKIA123",
				secretKey: "secret",
				configuration: {
					region: "eu-west-2",
					originationIdentity: "pool-abc123",
					mediaBucket: "polychat-mms-media",
					mediaKeyPrefix: "../escape",
				},
			}),
		).toThrow("key prefix");
	});

	it("rejects invalid AWS End User Messaging delivery controls", () => {
		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "aws-sms",
				apiKey: "AKIA123",
				secretKey: "secret",
				configuration: {
					region: "eu-west-2",
					originationIdentity: "pool-abc123",
					context: "not-json",
				},
			}),
		).toThrow("context");

		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "aws-sms",
				apiKey: "AKIA123",
				secretKey: "secret",
				configuration: {
					region: "eu-west-2",
					originationIdentity: "pool-abc123",
					messageFeedbackEnabled: "yes",
				},
			}),
		).toThrow("true or false");

		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "aws-sms",
				apiKey: "AKIA123",
				secretKey: "secret",
				configuration: {
					region: "eu-west-2",
					originationIdentity: "pool-abc123",
					timeToLive: "4",
				},
			}),
		).toThrow("TTL");
	});

	it("rejects incomplete AWS SMS credentials", () => {
		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "aws-sms",
				apiKey: "AKIA123",
				secretKey: "secret",
				configuration: {
					region: "eu-west-2",
				},
			}),
		).toThrow("AWS SMS credentials are incomplete");
	});

	it("rejects unsupported AWS End User Messaging message types", () => {
		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "aws-sms",
				apiKey: "AKIA123",
				secretKey: "secret",
				configuration: {
					region: "eu-west-2",
					originationIdentity: "pool-abc123",
					messageType: "priority",
				},
			}),
		).toThrow("message type");
	});

	it("parses typed messaging envelopes only", () => {
		const envelope = createMessagingCredentialEnvelope({
			providerId: "twilio-sms",
			apiKey: "AC123",
			secretKey: "token",
			configuration: {
				messagingServiceSid: "MG123",
			},
		});

		expect(
			parseMessagingCredentialEnvelope({
				providerId: "twilio-sms",
				value: JSON.stringify(envelope),
			}),
		).toEqual(envelope);
		expect(() =>
			parseMessagingCredentialEnvelope({
				providerId: "twilio-sms",
				value: "AC123::@@::token",
			}),
		).toThrow("must be reconfigured");
	});

	it("selects an enabled configured messaging provider from settings metadata", () => {
		expect(
			selectConfiguredMessagingProviderSettings([
				{
					id: "openai-row",
					provider_id: "openai",
					type: "chat",
					enabled: true,
					hasApiKey: true,
				},
				{
					id: "twilio-row",
					provider_id: "twilio-sms",
					type: "messaging",
					enabled: false,
					hasApiKey: true,
				},
				{
					id: "aws-row",
					provider_id: "aws-sms",
					type: "messaging",
					enabled: true,
					hasApiKey: true,
				},
			]),
		).toEqual({ id: "aws-row", providerId: "aws-sms" });

		expect(
			selectConfiguredMessagingProviderSettings([
				{
					id: "twilio-row",
					provider_id: "twilio-sms",
					type: "messaging",
					enabled: true,
					hasApiKey: false,
				},
			]),
		).toBeNull();
	});

	it("selects AWS End User Messaging when scheduled recipe media uses S3", () => {
		expect(
			selectConfiguredMessagingDelivery(
				[
					{
						id: "twilio-row",
						provider_id: "twilio-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
					},
					{
						id: "aws-row",
						provider_id: "aws-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
					},
				],
				{ mediaUrls: ["s3://polychat-mms/generated/image.png"] },
			),
		).toEqual({
			id: "aws-row",
			providerId: "aws-sms",
			mediaUrls: ["s3://polychat-mms/generated/image.png"],
		});
	});

	it("prefers Twilio over AWS for generic HTTPS media", () => {
		expect(
			selectConfiguredMessagingDelivery(
				[
					{
						id: "aws-row",
						provider_id: "aws-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
						configurationValues: {
							mediaBucket: "polychat-mms-media",
						},
					},
					{
						id: "twilio-row",
						provider_id: "twilio-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
					},
				],
				{
					mediaUrls: ["https://cdn.example.com/image.png"],
					apiBaseUrl: "https://api.polychat.test",
				},
			),
		).toEqual({
			id: "twilio-row",
			providerId: "twilio-sms",
			mediaUrls: ["https://cdn.example.com/image.png"],
		});
	});

	it("selects AWS End User Messaging for configured first-party private assets", () => {
		expect(
			selectConfiguredMessagingDelivery(
				[
					{
						id: "aws-row",
						provider_id: "aws-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
						configurationValues: {
							mediaBucket: "polychat-mms-media",
						},
					},
				],
				{
					mediaUrls: ["https://api.polychat.test/assets/generated-image"],
					apiBaseUrl: "https://api.polychat.test",
				},
			),
		).toEqual({
			id: "aws-row",
			providerId: "aws-sms",
			mediaUrls: ["https://api.polychat.test/assets/generated-image"],
		});
	});

	it("selects AWS End User Messaging for configured Pashi QR media", () => {
		expect(
			selectConfiguredMessagingDelivery(
				[
					{
						id: "aws-row",
						provider_id: "aws-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
						configurationValues: {
							mediaBucket: "polychat-mms-media",
						},
					},
				],
				{
					mediaUrls: ["http://pashi.app/api/qr?data=polychat&format=png&size=520x520"],
					apiBaseUrl: "https://api.polychat.test",
				},
			),
		).toEqual({
			id: "aws-row",
			providerId: "aws-sms",
			mediaUrls: ["http://pashi.app/api/qr?data=polychat&format=png&size=520x520"],
		});
	});

	it("does not select AWS End User Messaging for unsupported HTTPS media", () => {
		expect(
			selectConfiguredMessagingProviderSettings(
				[
					{
						id: "aws-row",
						provider_id: "aws-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
					},
				],
				{
					mediaUrls: ["https://api.polychat.test/assets/generated-image"],
					apiBaseUrl: "https://api.polychat.test",
				},
			),
		).toBeNull();

		expect(
			selectConfiguredMessagingProviderSettings(
				[
					{
						id: "aws-row",
						provider_id: "aws-sms",
						type: "messaging",
						enabled: true,
						hasApiKey: true,
						configurationValues: {
							mediaBucket: "polychat-mms-media",
						},
					},
				],
				{
					mediaUrls: ["https://cdn.example.com/image.png"],
					apiBaseUrl: "https://api.polychat.test",
				},
			),
		).toBeNull();
	});
});
