import { base64ToBuffer, bufferToBase64 } from "./base64";
import { AssistantError, ErrorType } from "./errors";

export interface EncryptedJsonPayload {
	v: 1;
	iv: string;
	data: string;
}

export async function sha256Hex(input: string): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(hash))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function deriveAesGcmKey(keyMaterial: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));

	return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptJsonPayload(params: {
	keyMaterial: string;
	payload: Record<string, unknown>;
}): Promise<EncryptedJsonPayload> {
	const key = await deriveAesGcmKey(params.keyMaterial);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = new TextEncoder().encode(JSON.stringify(params.payload));
	const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

	return {
		v: 1,
		iv: bufferToBase64(iv),
		data: bufferToBase64(new Uint8Array(encrypted)),
	};
}

export async function decryptJsonPayload(params: {
	keyMaterial: string;
	encrypted: EncryptedJsonPayload;
	invalidMessage?: string;
	reconnectMessage?: string;
}): Promise<Record<string, unknown>> {
	const invalidMessage = params.invalidMessage ?? "Encrypted payload is invalid";
	const reconnectMessage =
		params.reconnectMessage ?? "Encrypted payload could not be decrypted. Reconnect this provider.";

	if (
		params.encrypted.v !== 1 ||
		typeof params.encrypted.iv !== "string" ||
		typeof params.encrypted.data !== "string"
	) {
		throw new AssistantError(invalidMessage, ErrorType.PARAMS_ERROR);
	}

	try {
		const key = await deriveAesGcmKey(params.keyMaterial);
		const iv = new Uint8Array(base64ToBuffer(params.encrypted.iv));
		const ciphertext = new Uint8Array(base64ToBuffer(params.encrypted.data));
		const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
		const parsed = JSON.parse(new TextDecoder().decode(decrypted));

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new AssistantError(reconnectMessage, ErrorType.CONFLICT_ERROR, 409);
		}

		return parsed as Record<string, unknown>;
	} catch (error) {
		if (error instanceof AssistantError) {
			throw error;
		}

		if (
			error instanceof SyntaxError ||
			(error instanceof Error &&
				(error.name === "OperationError" || error.name === "InvalidCharacterError"))
		) {
			throw new AssistantError(reconnectMessage, ErrorType.CONFLICT_ERROR, 409);
		}

		throw error;
	}
}
