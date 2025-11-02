import type { R2Bucket } from "@cloudflare/workers-types";

import { AssistantError, ErrorType } from "~/utils/errors";

export class StorageService {
	constructor(private readonly bucket: R2Bucket) {}

	async getObject(key: string): Promise<string | null> {
		const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
		const object = await this.bucket.get(normalizedKey);
		if (!object) {
			return null;
		}
		const arrayBuffer = await object.arrayBuffer();
		return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
	}

	async uploadObject(
		key: string,
		data: string | ArrayBuffer | Uint8Array,
		options?: Record<string, string | number>,
	): Promise<string> {
		await this.bucket.put(key, data, options);
		return key;
	}

	async downloadFile(url: string): Promise<Blob> {
		if (!this.isValidImageUrl(url)) {
			throw new AssistantError(
				`Invalid image URL: ${url}`,
				ErrorType.PARAMS_ERROR,
			);
		}

		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new AssistantError(
					`Failed to download image: ${response.status} ${response.statusText}`,
					ErrorType.NETWORK_ERROR,
				);
			}

			const blob = await response.blob();

			if (!this.isSupportedImageType(blob.type)) {
				throw new AssistantError(
					`Unsupported image type: ${blob.type}. Supported types: image/png, image/jpeg, image/webp`,
					ErrorType.PARAMS_ERROR,
				);
			}

			return blob;
		} catch (error) {
			throw new AssistantError(
				`Network error downloading image: ${error instanceof Error ? error.message : "Unknown error"}`,
				ErrorType.NETWORK_ERROR,
			);
		}
	}

	private isValidImageUrl(url: string): boolean {
		try {
			const parsedUrl = new URL(url);
			return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
		} catch {
			return false;
		}
	}

	private isSupportedImageType(contentType: string): boolean {
		const supportedTypes = [
			"image/png",
			"image/jpeg",
			"image/jpg",
			"image/webp",
		];
		return supportedTypes.includes(contentType.toLowerCase());
	}
}
