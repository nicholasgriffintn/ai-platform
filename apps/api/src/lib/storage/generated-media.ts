import type { IEnv, ModelModalities } from "~/types";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import { base64ToBuffer } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getExtensionFromMimeType } from "~/utils/mime";
import { generateId } from "~/utils/id";

export interface GeneratedMediaContext {
	context?: ServiceContext;
	env?: IEnv;
	model?: string;
	modalities?: ModelModalities;
	completionId?: string;
	userId?: number;
}

export interface PersistedGeneratedAsset {
	assetId: string;
	key: string;
	url: string;
}

export interface PersistedRemoteGeneratedAsset {
	key: string;
	url: string;
	originalUrl: string;
}

export interface PersistedBase64GeneratedAsset {
	key: string;
	url: string;
	source: "base64";
}

interface PersistGeneratedAssetRequest {
	mediaContext: GeneratedMediaContext;
	extension: string;
	data: string | ArrayBuffer | Uint8Array;
	mimeType: string;
	filename: string;
}

interface PersistRemoteGeneratedAssetsRequest {
	mediaContext: GeneratedMediaContext;
	urls: string[];
	fallback: {
		extension: string;
		contentType: string;
	};
}

interface PersistGeneratedOutputRequest {
	mediaContext: GeneratedMediaContext;
	output: ReadableStream | string | ArrayBuffer | Uint8Array;
	extension: string;
	mimeType: string;
	filename: string;
	dataUrlMimePattern?: string;
}

function requireServiceContext(mediaContext: GeneratedMediaContext): ServiceContext {
	return resolveServiceContext({
		context: mediaContext.context,
		env: mediaContext.env,
	});
}

function requireUserId(mediaContext: GeneratedMediaContext): number {
	if (!mediaContext.userId) {
		throw new AssistantError(
			"User ID is required to store generated assets",
			ErrorType.FORBIDDEN,
			403,
		);
	}

	return mediaContext.userId;
}

function buildGeneratedAssetKey(mediaContext: GeneratedMediaContext, extension: string): string {
	const completion = mediaContext.completionId || "completion";
	const model = mediaContext.model || "model";
	const unique = `${Date.now()}-${generateId()}`;
	return `generations/${completion}/${model}/${unique}.${extension}`;
}

function getExtensionFromUrl(url: string, fallback: string): string {
	try {
		const parsed = new URL(url);
		const match = parsed.pathname.toLowerCase().match(/\.([a-z0-9]+)$/i);
		if (match?.[1]) {
			return match[1];
		}
	} catch {
		const match = url.split("?")[0].match(/\.([a-z0-9]+)$/i);
		if (match?.[1]) {
			return match[1];
		}
	}

	return fallback;
}

function getContentTypeFromExtension(extension: string, fallback: string): string {
	const mapping: Record<string, string> = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		webp: "image/webp",
		gif: "image/gif",
		mp4: "video/mp4",
		webm: "video/webm",
		mov: "video/quicktime",
		wav: "audio/wav",
		mp3: "audio/mpeg",
		m4a: "audio/mp4",
		ogg: "audio/ogg",
		flac: "audio/flac",
	};

	return mapping[extension] || fallback;
}

export function hasPrivateAssetStorage(mediaContext: GeneratedMediaContext): boolean {
	const env = mediaContext.context?.env ?? mediaContext.env;
	return Boolean(env?.PRIVATE_ASSETS_BUCKET);
}

function hasEnvironment(mediaContext: GeneratedMediaContext): boolean {
	return Boolean(mediaContext.context || mediaContext.env);
}

function assertGeneratedAssetStorageConfigured(mediaContext: GeneratedMediaContext): void {
	if (!hasPrivateAssetStorage(mediaContext) && hasEnvironment(mediaContext)) {
		throw new AssistantError(
			"Private assets bucket is not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}
}

export async function persistGeneratedAsset({
	mediaContext,
	extension,
	data,
	mimeType,
	filename,
}: PersistGeneratedAssetRequest): Promise<PersistedGeneratedAsset> {
	const context = requireServiceContext(mediaContext);
	const userId = requireUserId(mediaContext);
	const key = buildGeneratedAssetKey(mediaContext, extension);

	return await StorageService.forPrivateAssets(context).storePrivateAsset({
		key,
		data,
		ownerUserId: userId,
		purpose: "generated_media",
		mimeType,
		filename,
		byteSize:
			typeof data === "string" ? new TextEncoder().encode(data).byteLength : data.byteLength,
	});
}

async function readGeneratedOutput(
	output: PersistGeneratedOutputRequest["output"],
	dataUrlMimePattern?: string,
): Promise<ArrayBuffer | Uint8Array | string> {
	if (output instanceof ReadableStream) {
		const reader = output.getReader();
		const chunks: Uint8Array[] = [];
		let done = false;

		while (!done) {
			const result = await reader.read();
			done = result.done;
			if (result.value) {
				chunks.push(result.value);
			}
		}

		return new Uint8Array(chunks.reduce<number[]>((acc, chunk) => acc.concat([...chunk]), []));
	}

	if (typeof output !== "string") {
		return output;
	}

	const base64Data = dataUrlMimePattern
		? output.replace(new RegExp(`^data:${dataUrlMimePattern};base64,`), "")
		: output;

	return base64ToBuffer(base64Data);
}

export async function persistGeneratedOutput({
	mediaContext,
	output,
	extension,
	mimeType,
	filename,
	dataUrlMimePattern,
}: PersistGeneratedOutputRequest): Promise<PersistedGeneratedAsset> {
	return await persistGeneratedAsset({
		mediaContext,
		extension,
		data: await readGeneratedOutput(output, dataUrlMimePattern),
		mimeType,
		filename,
	});
}

export async function persistInlineGeneratedAsset(
	mediaContext: GeneratedMediaContext,
	asset: { data: string; mimeType?: string },
	kind: "image" | "audio",
): Promise<{ key?: string; url: string; mimeType: string }> {
	const mimeType = asset.mimeType || (kind === "image" ? "image/png" : "audio/pcm;rate=24000");
	const extension = getExtensionFromMimeType(mimeType, kind === "image" ? "png" : "pcm");

	if (!hasPrivateAssetStorage(mediaContext)) {
		assertGeneratedAssetStorageConfigured(mediaContext);
		return { url: `data:${mimeType};base64,${asset.data}`, mimeType };
	}

	const persisted = await persistGeneratedAsset({
		mediaContext,
		extension,
		data: base64ToBuffer(asset.data),
		mimeType,
		filename: `asset.${extension}`,
	});

	return {
		key: persisted.key,
		mimeType,
		url: persisted.url,
	};
}

export async function persistRemoteGeneratedAssets({
	mediaContext,
	urls,
	fallback,
}: PersistRemoteGeneratedAssetsRequest): Promise<{
	urls: string[];
	metadata: PersistedRemoteGeneratedAsset[];
}> {
	if (!urls.length) {
		return { urls: [], metadata: [] };
	}

	if (!hasPrivateAssetStorage(mediaContext)) {
		assertGeneratedAssetStorageConfigured(mediaContext);
		return { urls, metadata: [] };
	}

	const uploads = await Promise.all(
		urls.map(async (assetUrl) => {
			const response = await fetch(assetUrl);
			if (!response.ok) {
				throw new AssistantError(
					`Failed to fetch asset from ${assetUrl}`,
					ErrorType.PROVIDER_ERROR,
					response.status,
				);
			}

			const extension = getExtensionFromUrl(assetUrl, fallback.extension);
			const persisted = await persistGeneratedAsset({
				mediaContext,
				extension,
				data: await response.arrayBuffer(),
				mimeType: getContentTypeFromExtension(extension, fallback.contentType),
				filename: `asset.${extension}`,
			});

			return {
				key: persisted.key,
				url: persisted.url,
				originalUrl: assetUrl,
			};
		}),
	);

	return {
		urls: uploads.map((upload) => upload.url),
		metadata: uploads,
	};
}

export async function persistBase64GeneratedImages(
	mediaContext: GeneratedMediaContext,
	images: string[],
): Promise<{
	urls: string[];
	metadata: PersistedBase64GeneratedAsset[];
}> {
	if (!images.length) {
		return { urls: [], metadata: [] };
	}

	if (!hasPrivateAssetStorage(mediaContext)) {
		assertGeneratedAssetStorageConfigured(mediaContext);
		return { urls: images, metadata: [] };
	}

	const uploads = await Promise.all(
		images.map(async (image) => {
			const persisted = await persistGeneratedAsset({
				mediaContext,
				extension: "png",
				data: base64ToBuffer(image),
				mimeType: "image/png",
				filename: "image.png",
			});

			return { key: persisted.key, url: persisted.url, source: "base64" as const };
		}),
	);

	return {
		urls: uploads.map((upload) => upload.url),
		metadata: uploads,
	};
}
