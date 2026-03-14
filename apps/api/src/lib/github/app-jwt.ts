import { createPrivateKey, createSign } from "node:crypto";

import { encodeBase64Url } from "~/utils/base64url";
import { AssistantError, ErrorType } from "~/utils/errors";

const APP_JWT_EXP_SECONDS = 9 * 60;

export function normalizeGitHubPrivateKey(privateKeyRaw: string): string {
	let normalized = privateKeyRaw.trim();
	if (
		(normalized.startsWith('"') && normalized.endsWith('"')) ||
		(normalized.startsWith("'") && normalized.endsWith("'"))
	) {
		normalized = normalized.slice(1, -1).trim();
	}

	return normalized.replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").trim();
}

export function validateGitHubPrivateKey(privateKeyRaw: string): string {
	const normalized = normalizeGitHubPrivateKey(privateKeyRaw);
	const hasPemHeader =
		normalized.includes("-----BEGIN PRIVATE KEY-----") ||
		normalized.includes("-----BEGIN RSA PRIVATE KEY-----");

	if (!hasPemHeader) {
		throw new AssistantError(
			"Invalid GitHub App private key. Expected a PEM private key from GitHub App settings.",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}

	try {
		createPrivateKey(normalized);
		return normalized;
	} catch (error) {
		throw new AssistantError(
			"Invalid GitHub App private key. Use the PEM private key from GitHub App settings.",
			ErrorType.PARAMS_ERROR,
			400,
			{
				originalError: error instanceof Error ? error.message : String(error),
			},
		);
	}
}

export function createGitHubAppJwt(params: {
	appId: string;
	privateKey: string;
}): string {
	const { appId, privateKey } = params;
	const validatedKey = validateGitHubPrivateKey(privateKey);
	const now = Math.floor(Date.now() / 1000);

	const header = encodeBase64Url(
		Buffer.from(
			JSON.stringify({
				alg: "RS256",
				typ: "JWT",
			}),
		),
	);

	const payload = encodeBase64Url(
		Buffer.from(
			JSON.stringify({
				iat: now - 60,
				exp: now + APP_JWT_EXP_SECONDS,
				iss: appId,
			}),
		),
	);

	const signingInput = `${header}.${payload}`;
	const signer = createSign("RSA-SHA256");
	signer.update(signingInput);
	signer.end();

	const signature = signer.sign(validatedKey);
	return `${signingInput}.${encodeBase64Url(signature)}`;
}
