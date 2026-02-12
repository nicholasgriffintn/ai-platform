import { createSign } from "node:crypto";

import { encodeBase64Url } from "~/utils/base64url";

const APP_JWT_EXP_SECONDS = 9 * 60;

export function createGitHubAppJwt(params: {
	appId: string;
	privateKey: string;
}): string {
	const { appId, privateKey } = params;
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

	const signature = signer.sign(privateKey.replace(/\\n/g, "\n"));
	return `${signingInput}.${encodeBase64Url(signature)}`;
}
