import { describe, expect, it } from "vitest";

import {
	createMessagingCredentialEnvelope,
	parseMessagingCredentialEnvelope,
} from "../credentials";
import { selectConfiguredMessagingProviderId } from "../delivery";

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
				senderId: " Polychat ",
			},
		});

		expect(envelope).toEqual({
			version: 1,
			providerId: "aws-sms",
			credentials: {
				accessKeyId: "AKIA123",
				secretAccessKey: "secret",
				region: "eu-west-2",
				senderId: "Polychat",
			},
		});
	});

	it("rejects incomplete AWS SMS credentials", () => {
		expect(() =>
			createMessagingCredentialEnvelope({
				providerId: "aws-sms",
				apiKey: "AKIA123",
				secretKey: "secret",
			}),
		).toThrow("AWS SMS credentials are incomplete");
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
			selectConfiguredMessagingProviderId([
				{
					provider_id: "openai",
					type: "chat",
					enabled: true,
					hasApiKey: true,
				},
				{
					provider_id: "twilio-sms",
					type: "messaging",
					enabled: false,
					hasApiKey: true,
				},
				{
					provider_id: "aws-sms",
					type: "messaging",
					enabled: true,
					hasApiKey: true,
				},
			]),
		).toBe("aws-sms");

		expect(
			selectConfiguredMessagingProviderId([
				{
					provider_id: "twilio-sms",
					type: "messaging",
					enabled: true,
					hasApiKey: false,
				},
			]),
		).toBeNull();
	});
});
