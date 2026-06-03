import type { R2Bucket, R2ObjectBody } from "@cloudflare/workers-types";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CreateStoredAsset, StoredAssetPurpose } from "./asset-types";
import { buildAssetUrl } from "./asset-urls";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/storage" });

export interface StorePrivateAssetRequest {
	key: string;
	data: string | ArrayBuffer | Uint8Array;
	ownerUserId: number;
	purpose: StoredAssetPurpose;
	mimeType: string;
	filename?: string | null;
	byteSize?: number | null;
	conversationId?: string | null;
	messageId?: string | null;
	appDataId?: string | null;
}

export interface RecordPrivateAssetRequest {
	key: string;
	ownerUserId: number;
	purpose: StoredAssetPurpose;
	mimeType: string;
	filename?: string | null;
	byteSize?: number | null;
	conversationId?: string | null;
	messageId?: string | null;
	appDataId?: string | null;
}

export interface StoredAssetResult {
	assetId: string;
	key: string;
	url: string;
}

export class StorageService {
	constructor(
		private readonly bucket: R2Bucket,
		private readonly context?: ServiceContext,
	) {}

	static forPrivateAssets(context: ServiceContext): StorageService {
		if (!context.env.PRIVATE_ASSETS_BUCKET) {
			throw new AssistantError(
				"Private assets bucket is not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return new StorageService(context.env.PRIVATE_ASSETS_BUCKET, context);
	}

	async getObject(key: string): Promise<string | null> {
		logger.debug("Getting object from storage", { key });
		const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
		const object = await this.bucket.get(normalizedKey);
		if (!object) {
			return null;
		}
		const arrayBuffer = await object.arrayBuffer();
		return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
	}

	async getObjectBody(key: string): Promise<R2ObjectBody | null> {
		logger.debug("Getting object body from storage", { key });
		const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
		return this.bucket.get(normalizedKey);
	}

	async uploadObject(
		key: string,
		data: string | ArrayBuffer | Uint8Array,
		options?: Record<string, string | number>,
	): Promise<string> {
		logger.debug("Uploading object to storage", { key });

		await this.bucket.put(key, data, options);

		logger.debug("Object uploaded successfully", { key });

		return key;
	}

	async storePrivateAsset({
		key,
		data,
		ownerUserId,
		purpose,
		mimeType,
		filename,
		byteSize,
		conversationId,
		messageId,
		appDataId,
	}: StorePrivateAssetRequest): Promise<StoredAssetResult> {
		await this.uploadObject(key, data, {
			contentType: mimeType,
		});

		return await this.recordPrivateAsset({
			key,
			ownerUserId,
			purpose,
			mimeType,
			filename,
			byteSize,
			conversationId,
			messageId,
			appDataId,
		});
	}

	async recordPrivateAsset({
		key,
		ownerUserId,
		purpose,
		mimeType,
		filename,
		byteSize,
		conversationId,
		messageId,
		appDataId,
	}: RecordPrivateAssetRequest): Promise<StoredAssetResult> {
		const context = this.requireAssetContext();
		const assetId = generateId();
		const asset: CreateStoredAsset = {
			id: assetId,
			key,
			ownerUserId,
			conversationId,
			messageId,
			appDataId,
			purpose,
			mimeType,
			filename,
			byteSize,
		};
		const stored = await context.repositories.storedAssets.createAsset(asset);

		if (!stored) {
			throw new AssistantError("Failed to record stored asset", ErrorType.STORAGE_ERROR, 500);
		}

		return {
			assetId,
			key,
			url: buildAssetUrl(context.env, assetId),
		};
	}

	async downloadFile(url: string): Promise<Blob> {
		if (!this.isValidImageUrl(url)) {
			throw new AssistantError(`Invalid image URL: ${url}`, ErrorType.PARAMS_ERROR);
		}

		try {
			logger.debug("Downloading file from URL", { url });

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

			logger.debug("File downloaded successfully", { url });

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
		const supportedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
		return supportedTypes.includes(contentType.toLowerCase());
	}

	private requireAssetContext(): ServiceContext {
		if (!this.context) {
			throw new AssistantError(
				"Storage service asset context is not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return this.context;
	}
}
