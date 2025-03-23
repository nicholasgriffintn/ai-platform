const STORAGE_KEY = "encrypted_api_key";
const FALLBACK_STORAGE_KEY = "api_key";

const isWebCryptoAvailable = (): boolean => {
	try {
		return (
			typeof window !== "undefined" &&
			!!window.crypto &&
			!!window.crypto.subtle &&
			!!window.crypto.getRandomValues
		);
	} catch {
		return false;
	}
};

async function getEncryptionKey(): Promise<CryptoKey> {
	const keyMaterial = await window.crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(window.location.origin),
		"PBKDF2",
		false,
		["deriveBits", "deriveKey"],
	);

	return window.crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: new TextEncoder().encode("assistant_app_salt"),
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

export const apiKeyService = {
	setApiKey: async (apiKey: string): Promise<void> => {
		try {
			if (isWebCryptoAvailable()) {
				const key = await getEncryptionKey();
				const iv = window.crypto.getRandomValues(new Uint8Array(12));
				const encoded = new TextEncoder().encode(apiKey);

				const encrypted = await window.crypto.subtle.encrypt(
					{ name: "AES-GCM", iv },
					key,
					encoded,
				);

				const data = {
					iv: Array.from(iv),
					encrypted: Array.from(new Uint8Array(encrypted)),
				};

				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			} else {
				console.warn(
					"Web Crypto API not available, storing API key without encryption",
				);
				window.localStorage.setItem(FALLBACK_STORAGE_KEY, apiKey);
			}
		} catch (error) {
			console.error("Error storing API key:", error);
			try {
				console.warn("Encryption failed, falling back to direct storage");
				window.localStorage.setItem(FALLBACK_STORAGE_KEY, apiKey);
			} catch (fallbackError) {
				throw new Error("Failed to store API key");
			}
		}
	},

	getApiKey: async (): Promise<string | null> => {
		try {
			if (isWebCryptoAvailable()) {
				const data = window.localStorage.getItem(STORAGE_KEY);
				if (!data) {
					return window.localStorage.getItem(FALLBACK_STORAGE_KEY);
				}

				const { iv, encrypted } = JSON.parse(data);
				const key = await getEncryptionKey();

				const decrypted = await window.crypto.subtle.decrypt(
					{ name: "AES-GCM", iv: new Uint8Array(iv) },
					key,
					new Uint8Array(encrypted),
				);

				return new TextDecoder().decode(decrypted);
			}

			return window.localStorage.getItem(FALLBACK_STORAGE_KEY);
		} catch (error) {
			console.error("Error retrieving API key:", error);
			return window.localStorage.getItem(FALLBACK_STORAGE_KEY);
		}
	},

	removeApiKey: (): void => {
		try {
			window.localStorage.removeItem(STORAGE_KEY);
			window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
		} catch (error) {
			console.error("Error removing API key:", error);
		}
	},

	validateApiKey: (apiKey: string): boolean => {
		return (
			typeof apiKey === "string" &&
			apiKey.length >= 32 &&
			apiKey.length <= 256 &&
			/^[a-zA-Z0-9_-]+$/.test(apiKey)
		);
	},
};
