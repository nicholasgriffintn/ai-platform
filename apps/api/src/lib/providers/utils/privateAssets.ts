import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters, Message, MessageContent } from "~/types";
import { resolveRequestUser } from "~/utils/requestUser";

interface ResolvePrivateAssetsRequest {
	params: ChatCompletionParameters;
	storageService: StorageService;
	assetsUrl?: string;
}

export async function resolvePrivateAssetUrls({
	params,
	storageService,
	assetsUrl,
}: ResolvePrivateAssetsRequest): Promise<ChatCompletionParameters> {
	const messages = await Promise.all(
		params.messages.map((message) =>
			resolveMessageAssets({ message, params, storageService, assetsUrl }),
		),
	);

	return messages.every((message, index) => message === params.messages[index])
		? params
		: { ...params, messages };
}

async function resolveMessageAssets({
	message,
	...request
}: ResolvePrivateAssetsRequest & { message: Message }): Promise<Message> {
	if (!Array.isArray(message.content)) return message;

	const content = await Promise.all(
		message.content.map((part) => resolveAssetPart({ part, ...request })),
	);
	return content.every((part, index) => part === message.content[index])
		? message
		: { ...message, content };
}

async function resolveAssetPart({
	part,
	params,
	storageService,
	assetsUrl,
}: ResolvePrivateAssetsRequest & { part: MessageContent }): Promise<MessageContent> {
	const userId = resolveRequestUser(params)?.id;

	if (part.type === "image_url" && part.image_url?.url) {
		const url = await resolveUrl(part.image_url.url, storageService, userId, assetsUrl, {
			allowedMimePrefixes: ["image/"],
		});
		return url === part.image_url.url ? part : { ...part, image_url: { ...part.image_url, url } };
	}

	if (part.type === "document_url" && part.document_url?.url) {
		const url = await resolveUrl(part.document_url.url, storageService, userId, assetsUrl, {
			allowedMimeTypes: ["application/pdf"],
		});
		return url === part.document_url.url
			? part
			: { ...part, document_url: { ...part.document_url, url } };
	}

	if (part.type === "audio_url" && part.audio_url?.url) {
		const url = await resolveUrl(part.audio_url.url, storageService, userId, assetsUrl, {
			allowedMimePrefixes: ["audio/"],
		});
		return url === part.audio_url.url ? part : { ...part, audio_url: { ...part.audio_url, url } };
	}

	return part;
}

async function resolveUrl(
	url: string,
	storageService: StorageService,
	userId: number | undefined,
	assetsUrl: string | undefined,
	options: { allowedMimePrefixes?: string[]; allowedMimeTypes?: string[] },
): Promise<string> {
	if (url.startsWith("data:")) return url;
	return (await storageService.getPrivateAssetDataUrl(url, userId, assetsUrl, options)) ?? url;
}
