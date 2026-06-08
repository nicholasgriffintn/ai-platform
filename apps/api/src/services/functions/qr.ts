import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

const DEFAULT_QR_SIZE = "300x300";
const MAX_QR_PAYLOAD_LENGTH = 2000;
const QR_SIZE_PATTERN = /^([1-9]\d{1,3})x([1-9]\d{1,3})$/;
const QR_SERVICE_URL = "https://api.qrserver.com/v1/create-qr-code/";

function normaliseQrSize(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) {
		return DEFAULT_QR_SIZE;
	}

	const trimmed = value.trim().toLowerCase();
	const match = trimmed.match(QR_SIZE_PATTERN);
	if (!match) {
		return DEFAULT_QR_SIZE;
	}

	const width = Number.parseInt(match[1], 10);
	const height = Number.parseInt(match[2], 10);
	if (width > 1000 || height > 1000) {
		return DEFAULT_QR_SIZE;
	}

	return `${width}x${height}`;
}

function buildQrCodeUrl(payload: string, size: string): string {
	const url = new URL(QR_SERVICE_URL);
	url.searchParams.set("size", size);
	url.searchParams.set("data", payload);
	return url.toString();
}

export const create_qr_code: ApiToolDefinition = {
	name: "create_qr_code",
	description:
		"Creates a QR code image URL for exact user-supplied text, URLs, phone numbers, email addresses, or Wi-Fi payloads. Do not alter the payload before encoding.",
	type: "normal",
	costPerCall: 0,
	permissions: ["read"],
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			payload: {
				type: "string",
				description: "The exact text to encode into the QR code.",
			},
			size: {
				type: "string",
				description: "Optional QR image size such as 300x300. Defaults to 300x300.",
			},
		},
		required: ["payload"],
	}),
	execute: async (args) => {
		const payload = typeof args.payload === "string" ? args.payload.trim() : "";
		if (!payload) {
			return {
				status: "error",
				name: "create_qr_code",
				content: "Provide the exact text, URL, phone number, email, or Wi-Fi payload to encode.",
				data: {},
			};
		}
		if (payload.length > MAX_QR_PAYLOAD_LENGTH) {
			return {
				status: "error",
				name: "create_qr_code",
				content: `QR payloads are limited to ${MAX_QR_PAYLOAD_LENGTH} characters.`,
				data: { maxLength: MAX_QR_PAYLOAD_LENGTH },
			};
		}

		const size = normaliseQrSize(args.size);
		const imageUrl = buildQrCodeUrl(payload, size);

		return {
			status: "success",
			name: "create_qr_code",
			content:
				"QR code image URL created. Return this imageUrl to the user and include the encoded payload for review.",
			data: {
				imageUrl,
				payload,
				size,
			},
		};
	},
};
