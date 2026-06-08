import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";
import { assertQrPayloadByteLength, MAX_QR_PAYLOAD_BYTES, normaliseQrSize } from "~/utils/qr";

function buildQrImageUrl(apiBaseUrl: string | undefined, payload: string, size: string): string {
	const baseUrl = apiBaseUrl?.trim() || "https://api.polychat.app";
	const url = new URL("/qr", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
	url.searchParams.set("size", size);
	url.searchParams.set("format", "png");
	url.searchParams.set("data", payload);
	return url.toString();
}

export const create_qr_code: ApiToolDefinition = {
	name: "create_qr_code",
	description:
		"Creates a first-party QR code image URL for exact user-supplied text, URLs, phone numbers, email addresses, or Wi-Fi payloads. Do not alter the payload before encoding.",
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
	execute: async (args, context) => {
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
			assertQrPayloadByteLength(payload);
		} catch {
			return {
				status: "error",
				name: "create_qr_code",
				content: `QR payloads are limited to ${MAX_QR_PAYLOAD_BYTES} UTF-8 bytes.`,
				data: { maxBytes: MAX_QR_PAYLOAD_BYTES },
			};
		}

		const size = normaliseQrSize(args.size);
		const imageUrl = buildQrImageUrl(context.env.API_BASE_URL, payload, size.label);

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
