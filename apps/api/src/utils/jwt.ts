import { decodeBase64Url } from "./base64url";

export interface CompactJwtParts {
	encodedHeader: string;
	encodedPayload: string;
	encodedSignature: string;
	signingInput: Uint8Array;
	signature: Uint8Array;
}

export function splitCompactJwt(token: string): CompactJwtParts | null {
	const parts = token.split(".");
	const [encodedHeader, encodedPayload, encodedSignature] = parts;

	if (parts.length !== 3 || !encodedHeader || !encodedPayload || !encodedSignature) {
		return null;
	}

	let signature: Uint8Array;
	try {
		signature = decodeBase64Url(encodedSignature);
	} catch {
		return null;
	}

	return {
		encodedHeader,
		encodedPayload,
		encodedSignature,
		signingInput: new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
		signature,
	};
}

export function parseJwtJsonPart(encodedValue: string): unknown {
	return JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedValue)));
}
