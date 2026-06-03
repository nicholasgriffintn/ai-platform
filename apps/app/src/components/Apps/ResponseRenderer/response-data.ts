import { isRecord, readOptionalString } from "~/lib/objects";

interface ResolveResponseDataOptions {
	hasAppSchema: boolean;
	responseType?: string;
}

export interface GeneratedImageResponseData {
	title: string;
	content: string;
	imageUrl: string;
}

export interface GeneratedAudioResponseData {
	title: string;
	content: string;
	audioUrl: string;
}

export interface ResponseDisplayField {
	key: string;
	label: string;
}

export interface TableResponseData {
	headers: ResponseDisplayField[];
	rows: Record<string, unknown>[];
}

export function resolveResponseData(
	result: Record<string, unknown>,
	{ hasAppSchema, responseType }: ResolveResponseDataOptions,
) {
	const resultData = result.data || result;

	if (!isRecord(resultData)) {
		return resultData;
	}

	if (hasAppSchema && resultData.result) {
		return resultData.result;
	}

	if (responseType && "result" in resultData) {
		return resultData.result;
	}

	if (responseType && "results" in resultData) {
		return resultData.results;
	}

	return resultData;
}

export function resolveTextResponseData(result: Record<string, unknown>, responseData: unknown) {
	if (typeof responseData === "string") {
		return { content: responseData };
	}

	if (responseData && typeof responseData === "object" && "content" in responseData) {
		const content = responseData.content;
		return {
			content: typeof content === "string" ? content : JSON.stringify(content, null, 2),
		};
	}

	if (typeof result.content === "string") {
		return { content: result.content };
	}

	return { content: "" };
}

export function resolveJsonResponseData(responseData: unknown): Record<string, unknown> {
	return isRecord(responseData) ? responseData : { value: responseData };
}

export function resolveTemplateResponseData(responseData: unknown): Record<string, unknown> {
	return isRecord(responseData) ? responseData : {};
}

export function resolveTableResponseData(
	responseData: unknown,
	fields?: ResponseDisplayField[],
): TableResponseData {
	if (fields && Array.isArray(responseData)) {
		return {
			headers: fields,
			rows: responseData.filter(isRecord),
		};
	}

	if (!isRecord(responseData)) {
		return { headers: [], rows: [] };
	}

	const headers = Array.isArray(responseData.headers)
		? responseData.headers.filter(isResponseDisplayField)
		: [];
	const rows = Array.isArray(responseData.rows) ? responseData.rows.filter(isRecord) : [];

	return { headers, rows };
}

export function resolveGeneratedImageResponseData(
	responseData: unknown,
): GeneratedImageResponseData | null {
	if (!isRecord(responseData)) {
		return null;
	}

	const payload = isRecord(responseData.data) ? responseData.data : responseData;
	const toolName = readOptionalString(responseData.name) ?? readOptionalString(payload.name);
	const isScreenshot = toolName === "capture_screenshot" || toolName === "capture-screenshot";
	const imageUrl = resolveGeneratedImageUrl(payload, isScreenshot);

	if (!imageUrl) {
		return null;
	}

	return {
		title: isScreenshot ? "Captured Screenshot" : "Generated Image",
		content: resolveGeneratedImageContent(responseData, isScreenshot),
		imageUrl,
	};
}

export function resolveGeneratedAudioResponseData(
	responseData: unknown,
): GeneratedAudioResponseData | null {
	if (!isRecord(responseData)) {
		return null;
	}

	const payload = isRecord(responseData.data) ? responseData.data : responseData;
	const audioUrl = resolveGeneratedAudioUrl(payload);

	if (!audioUrl) {
		return null;
	}

	return {
		title: resolveGeneratedAudioTitle(responseData, payload),
		content: readOptionalString(responseData.content) ?? "",
		audioUrl,
	};
}

function resolveGeneratedImageUrl(
	payload: Record<string, unknown>,
	isScreenshot: boolean,
): string | undefined {
	return (
		readOptionalString(payload.screenshotUrl) ??
		readOptionalString(payload.imageUrl) ??
		readOptionalString(payload.image_url) ??
		resolveGeneratedAttachmentUrl(payload.attachments) ??
		(isScreenshot ? undefined : resolveDirectImageUrl(payload.url))
	);
}

function resolveGeneratedAudioUrl(payload: Record<string, unknown>): string | undefined {
	return (
		resolveGeneratedResponseAudioUrl(payload.response) ??
		resolveGeneratedRawResponseAudioUrl(payload.raw) ??
		resolveGeneratedAttachmentAudioUrl(payload.attachments) ??
		readOptionalString(payload.audioUrl) ??
		readOptionalString(payload.audio_url) ??
		resolveDirectAudioUrl(payload.url)
	);
}

function resolveGeneratedRawResponseAudioUrl(raw: unknown): string | undefined {
	return isRecord(raw) ? resolveGeneratedResponseAudioUrl(raw.response) : undefined;
}

function resolveGeneratedResponseAudioUrl(response: unknown): string | undefined {
	if (!Array.isArray(response)) {
		return undefined;
	}

	for (const item of response) {
		if (!isRecord(item) || item.type !== "audio_url" || !isRecord(item.audio_url)) {
			continue;
		}

		const url = readOptionalString(item.audio_url.url);
		if (url) {
			return url;
		}
	}

	return undefined;
}

function resolveGeneratedAttachmentUrl(attachments: unknown): string | undefined {
	if (!Array.isArray(attachments)) {
		return undefined;
	}

	for (const attachment of attachments) {
		if (!isRecord(attachment)) {
			continue;
		}

		const type = readOptionalString(attachment.type);
		const url = readOptionalString(attachment.url);

		if (url && (!type || type === "image")) {
			return url;
		}
	}

	return undefined;
}

function resolveGeneratedAttachmentAudioUrl(attachments: unknown): string | undefined {
	if (!Array.isArray(attachments)) {
		return undefined;
	}

	for (const attachment of attachments) {
		if (!isRecord(attachment)) {
			continue;
		}

		const type = readOptionalString(attachment.type);
		const url = readOptionalString(attachment.url);

		if (url && type === "audio") {
			return url;
		}
	}

	return undefined;
}

function resolveDirectAudioUrl(url: unknown): string | undefined {
	const value = readOptionalString(url);
	if (!value) {
		return undefined;
	}

	return /\.(mp3|wav|ogg|m4a|aac|flac)(?:[?#].*)?$/i.test(value) ? value : undefined;
}

function resolveDirectImageUrl(url: unknown): string | undefined {
	const value = readOptionalString(url);
	if (!value) {
		return undefined;
	}

	return /\.(jpg|jpeg|png|gif|webp)(?:[?#].*)?$/i.test(value) ? value : undefined;
}

function resolveGeneratedImageContent(
	responseData: Record<string, unknown>,
	isScreenshot: boolean,
): string {
	if (isScreenshot) {
		return "Screenshot captured.";
	}

	return readOptionalString(responseData.content) ?? "";
}

function resolveGeneratedAudioTitle(
	responseData: Record<string, unknown>,
	payload: Record<string, unknown>,
): string {
	const model = readOptionalString(responseData.model) ?? readOptionalString(payload.model);
	const name = readOptionalString(responseData.name) ?? readOptionalString(payload.name);
	const label = `${model ?? ""} ${name ?? ""}`.toLowerCase();

	return label.includes("music") ? "Generated Music" : "Generated Audio";
}

function isResponseDisplayField(value: unknown): value is ResponseDisplayField {
	return isRecord(value) && typeof value.key === "string" && typeof value.label === "string";
}
