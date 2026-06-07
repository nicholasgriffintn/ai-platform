import { decryptJsonPayload, encryptJsonPayload, type EncryptedJsonPayload } from "~/utils/crypto";

export type EncryptedGitHubConnectionPayload = EncryptedJsonPayload;

function getGitHubConnectionKeyMaterial(jwtSecret: string, userId: number): string {
	return `${jwtSecret}:${userId}:github-app-connection`;
}

export async function encryptGitHubConnectionPayload(params: {
	jwtSecret: string;
	userId: number;
	payload: Record<string, unknown>;
}): Promise<EncryptedGitHubConnectionPayload> {
	return encryptJsonPayload({
		keyMaterial: getGitHubConnectionKeyMaterial(params.jwtSecret, params.userId),
		payload: params.payload,
	});
}

export async function decryptGitHubConnectionPayload(params: {
	jwtSecret: string;
	userId: number;
	encrypted: EncryptedGitHubConnectionPayload;
}): Promise<Record<string, unknown>> {
	return decryptJsonPayload({
		keyMaterial: getGitHubConnectionKeyMaterial(params.jwtSecret, params.userId),
		encrypted: params.encrypted,
		invalidMessage: "GitHub App connection payload is invalid",
		reconnectMessage:
			"GitHub App connection could not be decrypted. Reconnect the GitHub App installation.",
	});
}
