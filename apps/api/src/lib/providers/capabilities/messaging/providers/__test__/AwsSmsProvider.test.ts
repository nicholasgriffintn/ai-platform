import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceContext } from "~/lib/context/serviceContext";

const mocks = vi.hoisted(() => ({
	awsFetch: vi.fn(),
	awsClient: vi.fn(),
}));

vi.mock("aws4fetch", () => ({
	AwsClient: mocks.awsClient,
}));

import { AwsSmsProvider, parseIncomingAwsSmsMessage } from "../AwsSmsProvider";

describe("AwsSmsProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.awsFetch.mockResolvedValue(
			new Response(JSON.stringify({ MessageId: "message-1" }), { status: 200 }),
		);
		mocks.awsClient.mockImplementation(function AwsClient() {
			return {
				fetch: mocks.awsFetch,
			};
		});
	});

	it("sends SMS and RCS-capable replies through AWS End User Messaging SendTextMessage", async () => {
		const provider = new AwsSmsProvider({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
			originationIdentity: "arn:aws:sms-voice:eu-west-2:123456789012:pool/pool-1",
			configurationSetName: "polychat-events",
			context: { app: "polychat" },
			destinationCountryParameters: {
				IN_ENTITY_ID: "entity-1",
				IN_TEMPLATE_ID: "template-1",
			},
			dryRun: false,
			messageFeedbackEnabled: true,
			messageType: "PROMOTIONAL",
			protectConfigurationId: "protect-1",
			timeToLive: 900,
		});

		await provider.send({ to: "+15551234567", body: "hello" });

		expect(mocks.awsClient).toHaveBeenCalledWith({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
			service: "sms-voice",
		});
		expect(mocks.awsFetch).toHaveBeenCalledWith(
			"https://sms-voice.pinpoint.eu-west-2.amazonaws.com/",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.0",
					"X-Amz-Target": "PinpointSMSVoiceV2.SendTextMessage",
				},
				body: expect.any(String),
			},
		);

		const requestBody = JSON.parse(mocks.awsFetch.mock.calls[0][1].body);
		expect(requestBody).toEqual({
			ConfigurationSetName: "polychat-events",
			Context: { app: "polychat" },
			DestinationPhoneNumber: "+15551234567",
			DestinationCountryParameters: {
				IN_ENTITY_ID: "entity-1",
				IN_TEMPLATE_ID: "template-1",
			},
			DryRun: false,
			MessageBody: "hello",
			MessageFeedbackEnabled: true,
			MessageType: "PROMOTIONAL",
			OriginationIdentity: "arn:aws:sms-voice:eu-west-2:123456789012:pool/pool-1",
			ProtectConfigurationId: "protect-1",
			TimeToLive: 900,
		});
	});

	it("sends MMS media through AWS End User Messaging SendMediaMessage", async () => {
		const provider = new AwsSmsProvider({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
			originationIdentity: "arn:aws:sms-voice:eu-west-2:123456789012:pool/pool-1",
			configurationSetName: "polychat-events",
			context: { app: "polychat" },
			destinationCountryParameters: {
				IN_ENTITY_ID: "entity-1",
				IN_TEMPLATE_ID: "template-1",
			},
			dryRun: false,
			messageFeedbackEnabled: true,
			protectConfigurationId: "protect-1",
			timeToLive: 900,
		});

		await provider.send({
			to: "+15551234567",
			body: "image attached",
			mediaUrls: ["s3://polychat-mms/generated/image.jpg"],
		});

		expect(mocks.awsFetch).toHaveBeenCalledWith(
			"https://sms-voice.pinpoint.eu-west-2.amazonaws.com/",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-amz-json-1.0",
					"X-Amz-Target": "PinpointSMSVoiceV2.SendMediaMessage",
				},
				body: expect.any(String),
			},
		);
		expect(JSON.parse(mocks.awsFetch.mock.calls[0][1].body)).toEqual({
			ConfigurationSetName: "polychat-events",
			Context: { app: "polychat" },
			DestinationPhoneNumber: "+15551234567",
			DryRun: false,
			MediaUrls: ["s3://polychat-mms/generated/image.jpg"],
			MessageBody: "image attached",
			MessageFeedbackEnabled: true,
			OriginationIdentity: "arn:aws:sms-voice:eu-west-2:123456789012:pool/pool-1",
			ProtectConfigurationId: "protect-1",
			TimeToLive: 900,
		});
	});

	it("copies first-party private media to S3 before sending AWS MMS", async () => {
		const privateAssetsBucket = {
			get: vi.fn(async () => ({
				arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
			})),
		};
		const storedAssets = {
			getAsset: vi.fn(async (assetId: string) => ({
				id: assetId,
				key: "generations/completion/model/image.png",
				owner_user_id: 42,
				conversation_id: null,
				message_id: null,
				app_data_id: null,
				purpose: "generated_media",
				mime_type: "image/png",
				filename: "image.png",
				byte_size: 3,
				created_at: "2026-06-08T10:00:00.000Z",
				updated_at: null,
			})),
		};
		const serviceContext = {
			env: {
				PRIVATE_ASSETS_BUCKET: privateAssetsBucket,
				API_BASE_URL: "https://api.polychat.test",
			},
			user: { id: 42 },
			requireUser: () => ({ id: 42 }),
			repositories: { storedAssets },
		} as unknown as ServiceContext;
		const provider = new AwsSmsProvider(
			{
				accessKeyId: "AKIA123",
				secretAccessKey: "secret",
				region: "eu-west-2",
				originationIdentity: "pool-1",
				mediaBucket: "polychat-mms-media",
				mediaKeyPrefix: "generated",
			},
			serviceContext,
		);

		await provider.send({
			to: "+15551234567",
			body: "image attached",
			mediaUrls: ["https://api.polychat.test/assets/asset-1"],
		});

		expect(storedAssets.getAsset).toHaveBeenCalledWith("asset-1");
		expect(privateAssetsBucket.get).toHaveBeenCalledWith("generations/completion/model/image.png");
		expect(mocks.awsClient).toHaveBeenNthCalledWith(1, {
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
			service: "s3",
		});
		expect(mocks.awsFetch.mock.calls[0][0]).toMatch(
			/^https:\/\/polychat-mms-media\.s3\.eu-west-2\.amazonaws\.com\/generated\/42\/.+\.png$/,
		);
		expect(mocks.awsFetch.mock.calls[0][1]).toMatchObject({
			method: "PUT",
			headers: { "Content-Type": "image/png" },
		});

		const sendMediaBody = JSON.parse(mocks.awsFetch.mock.calls[1][1].body);
		expect(sendMediaBody.MediaUrls[0]).toMatch(
			/^s3:\/\/polychat-mms-media\/generated\/42\/.+\.png$/,
		);
		expect(sendMediaBody).toMatchObject({
			DestinationPhoneNumber: "+15551234567",
			MessageBody: "image attached",
			OriginationIdentity: "pool-1",
		});
	});

	it("requires AWS MMS media to be a single S3 URL", async () => {
		const provider = new AwsSmsProvider({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
			originationIdentity: "pool-1",
		});

		await expect(
			provider.send({
				to: "+15551234567",
				body: "image attached",
				mediaUrls: ["https://example.com/image.jpg"],
			}),
		).rejects.toThrow("media bucket");
		expect(mocks.awsFetch).not.toHaveBeenCalled();
	});

	it("rejects SNS payloads with untrusted signing certificate URLs", async () => {
		const provider = new AwsSmsProvider({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
			originationIdentity: "pool-1",
		});
		const context = {
			req: {
				json: vi.fn(async () => ({
					Type: "Notification",
					MessageId: "message-1",
					TopicArn: "arn:aws:sns:eu-west-2:123456789012:inbound",
					Message: JSON.stringify({
						originationNumber: "+15551234567",
						destinationNumber: "+15557654321",
						messageBody: "hello",
					}),
					Timestamp: "2026-06-08T10:00:00.000Z",
					SignatureVersion: "2",
					Signature: "signature",
					SigningCertURL:
						"https://example.com/SimpleNotificationService-00000000000000000000000000000000.pem",
				})),
			},
		} as unknown as Context;

		await expect(provider.parseIncoming(context)).rejects.toThrow("not trusted");
	});

	it("parses signed AWS inbound text payloads without accepting media fields", () => {
		const incoming = parseIncomingAwsSmsMessage({
			Type: "Notification",
			MessageId: "message-1",
			TopicArn: "arn:aws:sns:eu-west-2:123456789012:inbound",
			Message: JSON.stringify({
				originationNumber: "+15551234567",
				destinationNumber: "arn:aws:sms-voice:eu-west-2:123456789012:rcs-agent/rcs-a1b2c3d4",
				messageBody: "hello",
				mediaUrls: ["https://example.com/image.jpg"],
				media: [{ url: "https://example.com/image.jpg", mimeType: "image/jpeg" }],
			}),
			Timestamp: "2026-06-08T10:00:00.000Z",
			SignatureVersion: "2",
			Signature: "signature",
			SigningCertURL:
				"https://sns.eu-west-2.amazonaws.com/SimpleNotificationService-00000000000000000000000000000000.pem",
		});

		expect(incoming).toEqual({
			kind: "message",
			from: "+15551234567",
			to: "arn:aws:sms-voice:eu-west-2:123456789012:rcs-agent/rcs-a1b2c3d4",
			body: "hello",
		});
	});

	it("rejects AWS inbound payloads that only contain media fields", () => {
		expect(() =>
			parseIncomingAwsSmsMessage({
				Type: "Notification",
				MessageId: "message-1",
				TopicArn: "arn:aws:sns:eu-west-2:123456789012:inbound",
				Message: JSON.stringify({
					originationNumber: "+15551234567",
					destinationNumber: "+15557654321",
					mediaUrls: ["https://example.com/image.jpg"],
				}),
				Timestamp: "2026-06-08T10:00:00.000Z",
				SignatureVersion: "2",
				Signature: "signature",
				SigningCertURL:
					"https://sns.eu-west-2.amazonaws.com/SimpleNotificationService-00000000000000000000000000000000.pem",
			}),
		).toThrow("missing sender or content");
	});
});
