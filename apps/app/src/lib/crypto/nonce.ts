export function createNonce(length = 32): string {
	const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
	const maxByte = Math.floor(256 / charset.length) * charset.length;
	const nonce: string[] = [];
	const randomValues = new Uint8Array(length);

	while (nonce.length < length) {
		crypto.getRandomValues(randomValues);

		for (const value of randomValues) {
			if (value >= maxByte) {
				continue;
			}

			nonce.push(charset[value % charset.length]);

			if (nonce.length === length) {
				break;
			}
		}
	}

	return nonce.join("");
}
