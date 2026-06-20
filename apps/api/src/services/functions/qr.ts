import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";
import {
	assertQrPayloadLength,
	buildQrImageUrl,
	MAX_QR_PAYLOAD_LENGTH,
	normaliseQrSize,
} from "~/utils/qr";

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
				description: "Optional QR image size such as 520x520. Defaults to 520x520.",
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
		try {
			assertQrPayloadLength(payload);
		} catch {
			return {
				status: "error",
				name: "create_qr_code",
				content: `QR payloads are limited to ${MAX_QR_PAYLOAD_LENGTH} characters.`,
				data: { maxLength: MAX_QR_PAYLOAD_LENGTH },
			};
		}

		const size = normaliseQrSize(args.size);
		const imageUrl = buildQrImageUrl(payload, size.label);

		return {
			status: "success",
			name: "create_qr_code",
			content:
				"QR code image created. Return this imageUrl to the user and include the encoded payload for review.",
			data: {
				imageUrl,
				mimeType: "image/png",
				payload,
				size: size.label,
			},
		};
	},
};
