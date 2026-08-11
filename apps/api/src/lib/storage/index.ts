import type { R2Bucket, R2ObjectBody } from "@cloudflare/workers-types";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { buildPrivateFileUrl, getPrivateFileResourceFromUrl } from "./resource-urls";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/storage" });
const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

interface StorePrivateFileRequest {
	key: string;
	data: string | ArrayBuffer | Uint8Array;
	mimeType: string;
	filename?: string | null;
	byteSize?: number | null;
}

export interface StoreSourceFileRequest extends StorePrivateFileRequest {
	createdByUserId: number;
	projectId?: string | null;
	conversationId?: string | null;
	title: string;
	content?: string | null;
	metadata?: Record<string, unknown>;
}

export interface StoreOutputFileRequest extends StorePrivateFileRequest {
	createdByUserId: number;
	projectId?: string | null;
	conversationId?: string | null;
	capabilityId: string;
	groupId?: string | null;
	kind: string;
	title: string;
	content?: unknown;
}

export interface RecordOutputFileRequest {
	key: string;
	createdByUserId: number;
	projectId?: string | null;
	conversationId?: string | null;
	capabilityId: string;
	groupId?: string | null;
	kind: string;
	title: string;
	content?: unknown;
	mimeType: string;
	filename?: string | null;
	byteSize?: number | null;
}

export interface StoredSourceFileResult {
	sourceId: string;
	key: string;
	url: string;
}

export interface StoredOutputFileResult {
	outputId: string;
	key: string;
	url: string;
}

export interface GetPrivateAssetBlobOptions {
	allowedMimePrefixes?: string[];
	allowedMimeTypes?: string[];
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

	async storeSourceFile({
		key,
		data,
		createdByUserId,
		mimeType,
		filename,
		byteSize,
		projectId,
		conversationId,
		title,
		content,
		metadata,
	}: StoreSourceFileRequest): Promise<StoredSourceFileResult> {
		await this.uploadObject(key, data, {
			contentType: mimeType,
		});
		const context = this.requireResourceContext();
		const source = await context.repositories.sources.createSource({
			createdByUserId,
			projectId,
			conversationId,
			kind: "file",
			title,
			content,
			metadata,
			storageKey: key,
			mimeType,
			filename,
			byteSize,
		});
		return { sourceId: source.id, key, url: buildPrivateFileUrl(context.env, "source", source.id) };
	}

	async storeOutputFile(input: StoreOutputFileRequest): Promise<StoredOutputFileResult> {
		await this.uploadObject(input.key, input.data, { contentType: input.mimeType });
		return this.recordOutputFile(input);
	}

	async recordOutputFile({
		key,
		createdByUserId,
		projectId,
		conversationId,
		capabilityId,
		groupId,
		kind,
		title,
		content,
		mimeType,
		filename,
		byteSize,
	}: RecordOutputFileRequest): Promise<StoredOutputFileResult> {
		const context = this.requireResourceContext();
		const output = await context.repositories.outputs.createOutput({
			createdByUserId,
			projectId,
			conversationId,
			capabilityId,
			groupId,
			kind,
			title,
			content,
			storageKey: key,
			mimeType,
			filename,
			byteSize,
		});
		return {
			outputId: output.id,
			key,
			url: buildPrivateFileUrl(context.env, "output", output.id),
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

			if (!SUPPORTED_IMAGE_MIME_TYPES.includes(blob.type.toLowerCase())) {
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
		return this.getPrivateAssetDataUrl(url, ownerUserId, assetsUrl, {
			allowedMimeTypes: SUPPORTED_IMAGE_MIME_TYPES,
		});
	}

	async getPrivateAssetDataUrl(
		url: string,
		userId?: number,
		assetsUrl?: string,
		options?: GetPrivateAssetBlobOptions,
	): Promise<string | null> {
		const asset = await this.getPrivateAsset(url, userId, assetsUrl, {
			...options,
			errorLabel: "asset",
		});
		if (!asset) {
			return null;
		}

		const base64Data = await this.getObject(asset.key);
		if (!base64Data) {
			throw new AssistantError("Private asset object not found", ErrorType.NOT_FOUND, 404);
		}

		return `data:${asset.mime_type};base64,${base64Data}`;
	}

	async getPrivateAssetImageBlob(
		url: string,
		ownerUserId?: number,
		assetsUrl?: string,
	): Promise<Blob | null> {
		return this.getPrivateAssetBlob(url, ownerUserId, assetsUrl, {
			allowedMimeTypes: SUPPORTED_IMAGE_MIME_TYPES,
		});
	}

	async getPrivateAssetBlob(
		url: string,
		ownerUserId?: number,
		assetsUrl?: string,
		options?: GetPrivateAssetBlobOptions,
	): Promise<Blob | null> {
		const asset = await this.getPrivateAsset(url, ownerUserId, assetsUrl, {
			...options,
			errorLabel: "asset",
		});
		if (!asset) {
			return null;
		}

		const object = await this.getObjectBody(asset.key);
		if (!object) {
			throw new AssistantError("Private asset object not found", ErrorType.NOT_FOUND, 404);
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

	private async getPrivateAsset(
		url: string,
		ownerUserId?: number,
		assetsUrl?: string,
		options?: GetPrivateAssetBlobOptions & { errorLabel?: string },
	): Promise<{ key: string; mime_type: string } | null> {
		const assetEnv = this.context?.env ?? this.env;
		const resource = getPrivateFileResourceFromUrl(url, assetsUrl || assetEnv?.API_BASE_URL);
		if (!resource) {
			return null;
		}

		if (!assetEnv) {
			throw new AssistantError(
				"Storage service asset environment is not configured",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		if (ownerUserId === undefined) {
			throw new AssistantError("User data required for private assets", ErrorType.FORBIDDEN);
		}

		const repositories = this.context?.repositories ?? new RepositoryManager(assetEnv);
		const record =
			resource.kind === "source"
				? await repositories.sources.getSource(resource.id)
				: await repositories.outputs.getOutput(resource.id);
		if (!record || !record.storage_key || !record.mime_type) {
			throw new AssistantError("Private asset not found", ErrorType.NOT_FOUND, 404);
		}

		if (record.project_id) {
			const accessUser = await repositories.users.getUserById(ownerUserId);
			const project = await repositories.workspaces.getProject(record.project_id);
			const membership =
				accessUser?.plan_id === "pro" && project
					? await repositories.workspaces.getMembership(project.workspace_id, ownerUserId)
					: null;
			if (!membership) {
				throw new AssistantError("Access denied for private asset", ErrorType.FORBIDDEN, 403);
			}
		} else if (record.created_by_user_id !== ownerUserId) {
			throw new AssistantError("Access denied for private asset", ErrorType.FORBIDDEN, 403);
		}

		const allowedMimeTypes = options?.allowedMimeTypes?.map((type) => type.toLowerCase());
		const allowedMimePrefixes = options?.allowedMimePrefixes?.map((prefix) => prefix.toLowerCase());
		const mimeType = record.mime_type.toLowerCase();
		const isAllowedMimeType =
			(!allowedMimeTypes?.length || allowedMimeTypes.includes(mimeType)) &&
			(!allowedMimePrefixes?.length ||
				allowedMimePrefixes.some((prefix) => mimeType.startsWith(prefix)));

		if (!isAllowedMimeType) {
			const label = options?.errorLabel ?? "asset";
			throw new AssistantError(
				`Unsupported ${label} type: ${record.mime_type}`,
				ErrorType.PARAMS_ERROR,
			);
		}

		return { key: record.storage_key, mime_type: record.mime_type };
	}

	private requireResourceContext(): ServiceContext {
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
