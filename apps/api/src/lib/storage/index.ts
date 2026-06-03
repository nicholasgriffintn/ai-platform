import type { R2Bucket, R2ObjectBody } from "@cloudflare/workers-types";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import type { CreateStoredAsset, StoredAsset, StoredAssetPurpose } from "./asset-types";
import { buildAssetUrl, getAssetIdFromUrl } from "./asset-urls";
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
		private readonly bucket: R2Bucket | undefined,
		private readonly context?: ServiceContext,
		private readonly env?: IEnv,
	) {}

	static forPrivateAssets(context: ServiceContext): StorageService {
		if (!context.env.PRIVATE_ASSETS_BUCKET) {
			throw new AssistantError(
				"Private assets bucket is not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return new StorageService(context.env.PRIVATE_ASSETS_BUCKET, context, context.env);
	}

	static forPrivateAssetsEnv(env: IEnv): StorageService {
		return new StorageService(env.PRIVATE_ASSETS_BUCKET, undefined, env);
	}

	async getObject(key: string): Promise<string | null> {
		logger.debug("Getting object from storage", { key });
		const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
		const object = await this.requireBucket().get(normalizedKey);
		if (!object) {
			return null;
		}
		const arrayBuffer = await object.arrayBuffer();
		return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
	}

	async getObjectBody(key: string): Promise<R2ObjectBody | null> {
		logger.debug("Getting object body from storage", { key });
		const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
		return this.requireBucket().get(normalizedKey);
	}

	async uploadObject(
		key: string,
		data: string | ArrayBuffer | Uint8Array,
		options?: Record<string, string | number>,
	): Promise<string> {
		logger.debug("Uploading object to storage", { key });

		await this.requireBucket().put(key, data, options);

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

	async downloadFile(url: string, ownerUserId?: number, assetsUrl?: string): Promise<Blob> {
		const privateAssetBlob = await this.getPrivateAssetImageBlob(url, ownerUserId, assetsUrl);
		if (privateAssetBlob) {
			return privateAssetBlob;
		}

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

	async getPrivateAssetImageDataUrl(
		url: string,
		ownerUserId?: number,
		assetsUrl?: string,
	): Promise<string | null> {
		const asset = await this.getPrivateAssetImage(url, ownerUserId, assetsUrl);
		if (!asset) {
			return null;
		}

		const base64Data = await this.getObject(asset.key);
		if (!base64Data) {
			throw new AssistantError("Image asset object not found", ErrorType.NOT_FOUND, 404);
		}

		return `data:${asset.mime_type};base64,${base64Data}`;
	}

	async getPrivateAssetImageBlob(
		url: string,
		ownerUserId?: number,
		assetsUrl?: string,
	): Promise<Blob | null> {
		const asset = await this.getPrivateAssetImage(url, ownerUserId, assetsUrl);
		if (!asset) {
			return null;
		}

		const object = await this.getObjectBody(asset.key);
		if (!object) {
			throw new AssistantError("Image asset object not found", ErrorType.NOT_FOUND, 404);
		}

		return new Blob([await object.arrayBuffer()], { type: asset.mime_type });
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

	private async getPrivateAssetImage(
		url: string,
		ownerUserId?: number,
		assetsUrl?: string,
	): Promise<StoredAsset | null> {
		const assetEnv = this.context?.env ?? this.env;
		const assetId = getAssetIdFromUrl(url, assetsUrl || assetEnv?.API_BASE_URL);
		if (!assetId) {
			return null;
		}

		if (!assetEnv) {
			throw new AssistantError(
				"Storage service asset environment is not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		if (ownerUserId === undefined) {
			throw new AssistantError("User data required for private image assets", ErrorType.FORBIDDEN);
		}

		const repositories = this.context?.repositories ?? new RepositoryManager(assetEnv);
		const asset = await repositories.storedAssets.getAsset(assetId);
		if (!asset) {
			throw new AssistantError("Image asset not found", ErrorType.NOT_FOUND, 404);
		}

		if (asset.owner_user_id !== ownerUserId) {
			throw new AssistantError("Access denied for image asset", ErrorType.FORBIDDEN, 403);
		}

		if (!this.isSupportedImageType(asset.mime_type)) {
			throw new AssistantError(
				`Unsupported image type: ${asset.mime_type}. Supported types: image/png, image/jpeg, image/webp`,
				ErrorType.PARAMS_ERROR,
			);
		}

		return asset;
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

	private requireBucket(): R2Bucket {
		if (!this.bucket) {
			throw new AssistantError(
				"Private assets bucket is not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return this.bucket;
	}
}
