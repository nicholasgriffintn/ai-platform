import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";

export const COMPOSIO_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const COMPOSIO_FILE_TRANSFER_TIMEOUT_MS = 15_000;

const FILE_SCHEMA_FORMATS = new Set(["binary", "byte", "file"]);
const FILE_FIELD_NAME = /(^|_)(attachment|audio|document|file|image|media|upload|video)(_|$)/i;
const MIME_TYPE_PATTERN =
	/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\s*;\s*[a-z0-9!#$&^_.+-]+=[a-z0-9!#$&^_.+"-]+)*$/i;

export function requireComposioMountPath(path: string): string {
	const candidate = path.trim();
	if (
		candidate.length === 0 ||
		candidate.length > 512 ||
		candidate.startsWith("/") ||
		candidate.includes("\\") ||
		hasControlCharacter(candidate)
	) {
		throw new AssistantError("Invalid Composio file path", ErrorType.PARAMS_ERROR, 400);
	}
	const segments = candidate.split("/");
	if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
		throw new AssistantError("Invalid Composio file path", ErrorType.PARAMS_ERROR, 400);
	}
	return candidate;
}

export function requireComposioFilename(filename: string): string {
	const candidate = filename.trim();
	if (
		candidate.length === 0 ||
		candidate.length > 255 ||
		candidate === "." ||
		candidate === ".." ||
		candidate.includes("/") ||
		candidate.includes("\\") ||
		hasControlCharacter(candidate)
	) {
		throw new AssistantError("Invalid Composio filename", ErrorType.PARAMS_ERROR, 400);
	}
	return candidate;
}

function hasControlCharacter(value: string): boolean {
	return [...value].some((character) => {
		const code = character.charCodeAt(0);
		return code <= 31 || code === 127;
	});
}

export function requireComposioFileMimeType(mimeType: string): string {
	const candidate = mimeType.trim().toLowerCase();
	if (candidate.length > 255 || !MIME_TYPE_PATTERN.test(candidate)) {
		throw new AssistantError("Invalid Composio file MIME type", ErrorType.PARAMS_ERROR, 400);
	}
	return candidate;
}

export function requireComposioFileSize(byteSize: number | null | undefined): void {
	if (
		byteSize !== null &&
		byteSize !== undefined &&
		(!Number.isSafeInteger(byteSize) || byteSize < 0 || byteSize > COMPOSIO_FILE_MAX_BYTES)
	) {
		throw new AssistantError(
			`Composio files must be at most ${COMPOSIO_FILE_MAX_BYTES} bytes`,
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
}

export function requireComposioPresignedUrl(value: string): string {
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new AssistantError(
			"Composio returned an invalid file URL",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}
	const hostname = parsed.hostname.toLowerCase();
	const allowedHost =
		hostname === "amazonaws.com" ||
		hostname.endsWith(".amazonaws.com") ||
		hostname === "r2.cloudflarestorage.com" ||
		hostname.endsWith(".r2.cloudflarestorage.com");
	if (
		parsed.protocol !== "https:" ||
		parsed.username ||
		parsed.password ||
		(parsed.port && parsed.port !== "443") ||
		!allowedHost
	) {
		throw new AssistantError(
			"Composio returned an unsafe file URL",
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}
	return parsed.toString();
}

export async function readBoundedResponseBody(
	response: Response,
	maxBytes = COMPOSIO_FILE_MAX_BYTES,
): Promise<ArrayBuffer> {
	const declaredLength = response.headers.get("content-length");
	if (declaredLength) {
		const parsedLength = Number(declaredLength);
		if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > maxBytes) {
			throw new AssistantError("Composio file is too large", ErrorType.PARAMS_ERROR, 400);
		}
	}
	if (!response.body) return new ArrayBuffer(0);

	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	const reader = response.body.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel();
				throw new AssistantError("Composio file is too large", ErrorType.PARAMS_ERROR, 400);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body.buffer;
}

export function composioSchemaAcceptsFiles(schema: Record<string, unknown>): boolean {
	return schemaNodeAcceptsFiles(schema, new Set());
}

function schemaNodeAcceptsFiles(value: unknown, visited: Set<object>): boolean {
	if (!isRecord(value) || visited.has(value)) return false;
	visited.add(value);
	if (
		(typeof value.format === "string" && FILE_SCHEMA_FORMATS.has(value.format.toLowerCase())) ||
		typeof value.contentMediaType === "string" ||
		value.contentEncoding === "base64" ||
		(typeof value.$ref === "string" && /file|attachment/i.test(value.$ref))
	) {
		return true;
	}
	if (isRecord(value.properties)) {
		for (const [name, property] of Object.entries(value.properties)) {
			if (FILE_FIELD_NAME.test(name) || schemaNodeAcceptsFiles(property, visited)) return true;
		}
	}
	for (const key of ["items", "anyOf", "allOf", "oneOf", "$defs", "definitions"]) {
		const child = value[key];
		if (Array.isArray(child)) {
			if (child.some((item) => schemaNodeAcceptsFiles(item, visited))) return true;
		} else if (isRecord(child)) {
			if (Object.values(child).some((item) => schemaNodeAcceptsFiles(item, visited))) return true;
		}
	}
	return false;
}
