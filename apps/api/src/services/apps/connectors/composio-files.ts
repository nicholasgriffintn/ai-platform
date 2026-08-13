import type { ServiceContext } from "~/lib/context/serviceContext";
import {
	createComposioSessionMountDownloadUrl,
	createComposioSessionMountUploadUrl,
} from "~/lib/providers/capabilities/connectors/composio/client";
import { StorageService } from "~/lib/storage";
import { getPrivateFileResourceFromUrl } from "~/lib/storage/resource-urls";
import { requireOutputAccess, requireConversationScope } from "~/services/outputs/access";
import { getSource } from "~/services/sources";
import { requireProjectAccess } from "~/services/workspaces/access";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { isRecord } from "~/utils/objects";
import {
	COMPOSIO_FILE_MAX_BYTES,
	COMPOSIO_FILE_TRANSFER_TIMEOUT_MS,
	composioSchemaAcceptsFiles,
	readBoundedResponseBody,
	requireComposioFilename,
	requireComposioFileMimeType,
	requireComposioFileSize,
	requireComposioMountPath,
	requireComposioPresignedUrl,
} from "./composio-files-security";

export interface ComposioMountFileUrl {
	url: string;
	mountRelativePath: string;
	sandboxMountPrefix: string;
	expiresAt: string;
}

export interface ComposioMountFileClient {
	createUploadUrl(input: {
		sessionId: string;
		mountId: string;
		mountRelativePath: string;
		mimeType: string;
	}): Promise<ComposioMountFileUrl>;
	createDownloadUrl(input: {
		sessionId: string;
		mountId: string;
		mountRelativePath: string;
	}): Promise<ComposioMountFileUrl>;
}

export interface ComposioFileResourceReference {
	kind: "source" | "output";
	id: string;
}

export interface StagedComposioFile {
	mountRelativePath: string;
	sandboxPath: string;
	mimeType: string;
	filename: string;
	byteSize: number;
}

export interface ImportedComposioOutputReference {
	$assistantOutput: {
		id: string;
		filename: string;
		mimeType: string;
		byteSize: number;
	};
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createComposioMountFileClient(env: IEnv): ComposioMountFileClient {
	return {
		createUploadUrl: (input) => createComposioSessionMountUploadUrl({ env, ...input }),
		createDownloadUrl: (input) => createComposioSessionMountDownloadUrl({ env, ...input }),
	};
}

export function assertComposioFileBridgeAvailable(params: {
	bridgeAvailable: boolean;
	inputSchema: Record<string, unknown>;
}): void {
	if (!params.bridgeAvailable && composioSchemaAcceptsFiles(params.inputSchema)) {
		throw new AssistantError(
			"This connector operation accepts files, but the Composio file bridge is unavailable",
			ErrorType.CONFIGURATION_ERROR,
			503,
		);
	}
}

export async function stageComposioResourceFile(params: {
	context: ServiceContext;
	userId: number;
	client: ComposioMountFileClient;
	sessionId: string;
	resource: ComposioFileResourceReference;
	projectId?: string | null;
	conversationId?: string | null;
	mountRelativePath?: string;
	mountId?: string;
	fetcher?: Fetcher;
}): Promise<StagedComposioFile> {
	const file = await requireResourceFile(
		params.context,
		params.userId,
		params.resource,
		params.projectId,
		params.conversationId,
	);
	requireComposioFileSize(file.byteSize);
	const filename = requireComposioFilename(file.filename ?? `${params.resource.id}.bin`);
	const mimeType = requireComposioFileMimeType(file.mimeType);
	const mountRelativePath = requireComposioMountPath(params.mountRelativePath ?? filename);
	const object = await StorageService.forPrivateAssets(params.context).getObjectBody(file.key);
	if (!object) throw new AssistantError("Private asset object not found", ErrorType.NOT_FOUND, 404);
	requireComposioFileSize(object.size);
	const body = await object.arrayBuffer();
	requireComposioFileSize(body.byteLength);

	const upload = await params.client.createUploadUrl({
		sessionId: params.sessionId,
		mountId: params.mountId ?? "files",
		mountRelativePath,
		mimeType,
	});
	const uploadUrl = requireComposioPresignedUrl(upload.url);
	const response = await transfer(params.fetcher ?? fetch, uploadUrl, {
		method: "PUT",
		headers: { "Content-Type": mimeType },
		body,
	});
	if (!response.ok) {
		throw new AssistantError(
			"Could not upload file to Composio",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}

	const returnedPath = requireComposioMountPath(upload.mountRelativePath);
	const prefix = requireSandboxMountPrefix(upload.sandboxMountPrefix);
	return {
		mountRelativePath: returnedPath,
		sandboxPath: `${prefix}/${returnedPath}`,
		mimeType,
		filename,
		byteSize: body.byteLength,
	};
}

export async function importComposioSessionFile(params: {
	context: ServiceContext;
	userId: number;
	client: ComposioMountFileClient;
	sessionId: string;
	mountRelativePath: string;
	mimeType: string;
	mountId?: string;
	projectId?: string | null;
	conversationId?: string | null;
	title?: string;
	fetcher?: Fetcher;
}): Promise<{ outputId: string; filename: string; byteSize: number }> {
	const mountRelativePath = requireComposioMountPath(params.mountRelativePath);
	const filename = requireComposioFilename(mountRelativePath.split("/").at(-1) ?? "");
	const mimeType = requireComposioFileMimeType(params.mimeType);
	await requireImportScope(params);

	const download = await params.client.createDownloadUrl({
		sessionId: params.sessionId,
		mountId: params.mountId ?? "files",
		mountRelativePath,
	});
	const downloadUrl = requireComposioPresignedUrl(download.url);
	const response = await transfer(params.fetcher ?? fetch, downloadUrl, { method: "GET" });
	if (!response.ok) {
		throw new AssistantError(
			"Could not download file from Composio",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}
	assertCompatibleMimeType(response.headers.get("content-type"), mimeType);
	const body = await readBoundedResponseBody(response);

	const key = `composio/outputs/${params.userId}/${generateId()}/${filename}`;
	const stored = await StorageService.forPrivateAssets(params.context).storeOutputFile({
		key,
		data: body,
		createdByUserId: params.userId,
		projectId: params.projectId ?? null,
		conversationId: params.conversationId ?? null,
		capabilityId: "recipe-connectors",
		kind: "file",
		title: params.title?.trim() || filename,
		content: { provider: "composio", sessionId: params.sessionId, mountRelativePath },
		mimeType,
		filename,
		byteSize: body.byteLength,
	});
	return { outputId: stored.outputId, filename, byteSize: body.byteLength };
}

export async function resolveComposioFileReferences(params: {
	context: ServiceContext;
	userId: number;
	client: ComposioMountFileClient;
	sessionId: string;
	value: unknown;
	mountId?: string;
	projectId?: string | null;
	conversationId?: string | null;
	fetcher?: Fetcher;
}): Promise<unknown> {
	return resolveFileValue(params, params.value);
}

export async function importComposioOperationFileResults(params: {
	context: ServiceContext;
	userId: number;
	client: ComposioMountFileClient;
	sessionId: string;
	value: unknown;
	mountId?: string;
	projectId?: string | null;
	conversationId?: string | null;
	fetcher?: Fetcher;
}): Promise<unknown> {
	return importOperationFileValue(params, params.value);
}

async function importOperationFileValue(
	params: Parameters<typeof importComposioOperationFileResults>[0],
	value: unknown,
): Promise<unknown> {
	const descriptor = parseComposioMountFileDescriptor(value);
	if (descriptor) {
		const imported = await importComposioSessionFile({
			...params,
			mountRelativePath: descriptor.mountRelativePath,
			mimeType: descriptor.mimeType,
		});
		return {
			$assistantOutput: {
				id: imported.outputId,
				filename: imported.filename,
				mimeType: descriptor.mimeType,
				byteSize: imported.byteSize,
			},
		} satisfies ImportedComposioOutputReference;
	}
	if (Array.isArray(value)) {
		return Promise.all(value.map((item) => importOperationFileValue(params, item)));
	}
	if (isRecord(value)) {
		const entries = await Promise.all(
			Object.entries(value).map(async ([key, item]) => [
				key,
				await importOperationFileValue(params, item),
			]),
		);
		return Object.fromEntries(entries);
	}
	return value;
}

function parseComposioMountFileDescriptor(
	value: unknown,
): { mountRelativePath: string; mimeType: string } | undefined {
	if (!isRecord(value)) return undefined;
	const mountRelativePath =
		typeof value.mount_relative_path === "string"
			? value.mount_relative_path
			: typeof value.mountRelativePath === "string"
				? value.mountRelativePath
				: undefined;
	const mountPrefix =
		typeof value.sandbox_mount_prefix === "string"
			? value.sandbox_mount_prefix
			: typeof value.sandboxMountPrefix === "string"
				? value.sandboxMountPrefix
				: undefined;
	if (!mountRelativePath || !mountPrefix) return undefined;

	const mimeType =
		typeof value.mimetype === "string"
			? value.mimetype
			: typeof value.mime_type === "string"
				? value.mime_type
				: typeof value.mimeType === "string"
					? value.mimeType
					: undefined;
	if (!mimeType) return undefined;
	if (requireSandboxMountPrefix(mountPrefix) !== "/mnt/files") {
		throw new AssistantError(
			"Composio file is outside the session files mount",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}
	return {
		mountRelativePath: requireComposioMountPath(mountRelativePath),
		mimeType: requireComposioFileMimeType(mimeType),
	};
}

async function resolveFileValue(
	params: Parameters<typeof resolveComposioFileReferences>[0],
	value: unknown,
): Promise<unknown> {
	const reference = parseFileReference(value, params.context.env.API_BASE_URL);
	if (reference) {
		const staged = await stageComposioResourceFile({
			...params,
			resource: reference.resource,
			mountRelativePath: reference.path,
		});
		return staged.sandboxPath;
	}
	if (Array.isArray(value)) {
		return Promise.all(value.map((item) => resolveFileValue(params, item)));
	}
	if (isRecord(value)) {
		const entries = await Promise.all(
			Object.entries(value).map(async ([key, item]) => [key, await resolveFileValue(params, item)]),
		);
		return Object.fromEntries(entries);
	}
	return value;
}

function parseFileReference(
	value: unknown,
	apiBaseUrl?: string,
): { resource: ComposioFileResourceReference; path?: string } | undefined {
	if (typeof value === "string") {
		const resource = getPrivateFileResourceFromUrl(value, apiBaseUrl);
		return resource ? { resource } : undefined;
	}
	if (!isRecord(value) || !("$assistantFile" in value)) return undefined;
	const marker = value.$assistantFile;
	const path = isRecord(marker) ? marker.path : undefined;
	if (
		!isRecord(marker) ||
		(marker.kind !== "source" && marker.kind !== "output") ||
		typeof marker.id !== "string" ||
		marker.id.trim().length === 0 ||
		(path !== undefined && typeof path !== "string")
	) {
		throw new AssistantError("Invalid assistant file reference", ErrorType.PARAMS_ERROR, 400);
	}
	return {
		resource: { kind: marker.kind, id: marker.id },
		path: typeof path === "string" ? path : undefined,
	};
}

async function requireResourceFile(
	context: ServiceContext,
	userId: number,
	resource: ComposioFileResourceReference,
	projectId?: string | null,
	conversationId?: string | null,
): Promise<{ key: string; mimeType: string; filename: string | null; byteSize: number | null }> {
	let file: {
		key: string;
		mimeType: string;
		filename?: string | null;
		byteSize?: number | null;
	} | null;
	if (resource.kind === "source") {
		const source = await getSource(context, userId, resource.id);
		requireMatchingResourceScope(
			source.projectId,
			source.conversationId,
			projectId,
			conversationId,
		);
		file = source.file
			? {
					key: source.file.key,
					mimeType: source.file.mimeType,
					filename: source.file.filename ?? null,
					byteSize: source.file.byteSize ?? null,
				}
			: null;
	} else {
		const output = await requireOutputAccess(context, userId, resource.id);
		requireMatchingResourceScope(
			output.project_id,
			output.conversation_id,
			projectId,
			conversationId,
		);
		file = outputRecordFile(output);
	}
	if (!file) {
		throw new AssistantError("Resource does not contain a file", ErrorType.PARAMS_ERROR, 400);
	}
	return {
		key: file.key,
		mimeType: file.mimeType,
		filename: file.filename ?? null,
		byteSize: file.byteSize ?? null,
	};
}

function requireMatchingResourceScope(
	resourceProjectId: string | null,
	resourceConversationId: string | null,
	projectId?: string | null,
	conversationId?: string | null,
): void {
	if ((resourceProjectId ?? null) !== (projectId ?? null)) {
		throw new AssistantError("Resource is outside this project", ErrorType.NOT_FOUND, 404);
	}
	if (resourceConversationId && resourceConversationId !== conversationId) {
		throw new AssistantError("Resource is outside this conversation", ErrorType.NOT_FOUND, 404);
	}
}

function outputRecordFile(record: Awaited<ReturnType<typeof requireOutputAccess>>) {
	if (!record.storage_key || !record.mime_type) return null;
	return {
		key: record.storage_key,
		mimeType: record.mime_type,
		filename: record.filename,
		byteSize: record.byte_size,
	};
}

async function requireImportScope(params: {
	context: ServiceContext;
	userId: number;
	projectId?: string | null;
	conversationId?: string | null;
}): Promise<void> {
	if (params.projectId) await requireProjectAccess(params.context, params.projectId);
	if (params.conversationId) {
		await requireConversationScope(
			params.context,
			params.userId,
			params.conversationId,
			params.projectId,
		);
	}
}

async function transfer(fetcher: Fetcher, url: string, init: RequestInit): Promise<Response> {
	try {
		return await fetcher(url, {
			...init,
			signal: AbortSignal.timeout(COMPOSIO_FILE_TRANSFER_TIMEOUT_MS),
		});
	} catch (error) {
		throw new AssistantError(
			error instanceof DOMException && error.name === "TimeoutError"
				? "Composio file transfer timed out"
				: "Composio file transfer failed",
			ErrorType.NETWORK_ERROR,
			502,
		);
	}
}

function requireSandboxMountPrefix(value: string): string {
	if (!/^\/mnt\/[a-z0-9_-]+$/i.test(value)) {
		throw new AssistantError(
			"Composio returned an invalid mount",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}
	return value;
}

function assertCompatibleMimeType(received: string | null, expected: string): void {
	if (!received) return;
	const normalized = received.split(";", 1)[0]?.trim().toLowerCase();
	if (
		normalized &&
		normalized !== expected.split(";", 1)[0] &&
		normalized !== "application/octet-stream"
	) {
		throw new AssistantError(
			"Composio file MIME type did not match",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}
}

export { COMPOSIO_FILE_MAX_BYTES };
