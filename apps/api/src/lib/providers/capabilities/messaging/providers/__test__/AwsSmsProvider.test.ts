import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	awsFetch: vi.fn(),
	awsClient: vi.fn(),
}));

vi.mock("aws4fetch", () => ({
	AwsClient: mocks.awsClient,
}));

import { AwsSmsProvider } from "../AwsSmsProvider";

describe("AwsSmsProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.awsFetch.mockResolvedValue(new Response("<PublishResponse />", { status: 200 }));
		mocks.awsClient.mockImplementation(function AwsClient() {
			return {
				fetch: mocks.awsFetch,
			};
		});
	});

	it("sends SMS replies through SNS Publish", async () => {
		const provider = new AwsSmsProvider({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
			senderId: "Polychat",
		});

		await provider.send({ to: "+15551234567", body: "hello" });

		expect(mocks.awsClient).toHaveBeenCalledWith({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
			service: "sns",
		});
		expect(mocks.awsFetch).toHaveBeenCalledWith("https://sns.eu-west-2.amazonaws.com/", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: expect.any(String),
		});

		const requestBody = new URLSearchParams(mocks.awsFetch.mock.calls[0][1].body);
		expect(requestBody.get("Action")).toBe("Publish");
		expect(requestBody.get("PhoneNumber")).toBe("+15551234567");
		expect(requestBody.get("Message")).toBe("hello");
		expect(requestBody.get("MessageAttributes.entry.1.Value.StringValue")).toBe("Transactional");
		expect(requestBody.get("MessageAttributes.entry.2.Value.StringValue")).toBe("Polychat");
	});

	it("rejects SNS payloads with untrusted signing certificate URLs", async () => {
		const provider = new AwsSmsProvider({
			accessKeyId: "AKIA123",
			secretAccessKey: "secret",
			region: "eu-west-2",
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
});
