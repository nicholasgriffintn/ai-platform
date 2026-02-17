import { base64ToBuffer, bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface EncryptedGitHubConnectionPayload {
	v: 1;
	iv: string;
	data: string;
}

async function deriveUserJwtScopedKey(
	jwtSecret: string,
	userId: number,
): Promise<CryptoKey> {
	const keyMaterial = `${jwtSecret}:${userId}:github-app-connection`;
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(keyMaterial),
	);

	return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
		"encrypt",
		"decrypt",
	]);
}

export async function encryptGitHubConnectionPayload(params: {
	jwtSecret: string;
	userId: number;
	payload: Record<string, unknown>;
}): Promise<EncryptedGitHubConnectionPayload> {
	const { jwtSecret, userId, payload } = params;

	const key = await deriveUserJwtScopedKey(jwtSecret, userId);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = new TextEncoder().encode(JSON.stringify(payload));

	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		plaintext,
	);

	return {
		v: 1,
		iv: bufferToBase64(iv),
		data: bufferToBase64(new Uint8Array(encrypted)),
	};
}

export async function decryptGitHubConnectionPayload(params: {
	jwtSecret: string;
	userId: number;
	encrypted: EncryptedGitHubConnectionPayload;
}): Promise<Record<string, unknown>> {
	const { jwtSecret, userId, encrypted } = params;

	if (
		encrypted.v !== 1 ||
		typeof encrypted.iv !== "string" ||
		typeof encrypted.data !== "string"
	) {
		throw new AssistantError(
			"GitHub App connection payload is invalid",
			ErrorType.PARAMS_ERROR,
		);
	}

	const key = await deriveUserJwtScopedKey(jwtSecret, userId);
	const iv = new Uint8Array(base64ToBuffer(encrypted.iv));
	const ciphertext = new Uint8Array(base64ToBuffer(encrypted.data));
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		ciphertext,
	);

	const text = new TextDecoder().decode(decrypted);
	const parsed = JSON.parse(text);

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new AssistantError(
			"GitHub App connection payload is invalid",
			ErrorType.PARAMS_ERROR,
		);
	}

	return parsed as Record<string, unknown>;
}
