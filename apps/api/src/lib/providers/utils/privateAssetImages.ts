import type { StorageService } from "~/lib/storage";
import type { ChatCompletionParameters, Message, MessageContent } from "~/types";
import { resolveRequestUser } from "~/utils/requestUser";

interface ResolvePrivateAssetImagesRequest {
	params: ChatCompletionParameters;
	storageService: StorageService;
	assetsUrl?: string;
}

export async function resolvePrivateAssetImageUrls({
	params,
	storageService,
	assetsUrl,
}: ResolvePrivateAssetImagesRequest): Promise<ChatCompletionParameters> {
	const messages = await Promise.all(
		params.messages.map((message) =>
			resolvePrivateAssetImageUrlsInMessage({
				message,
				params,
				storageService,
				assetsUrl,
			}),
		),
	);

	if (messages.every((message, index) => message === params.messages[index])) {
		return params;
	}

	return {
		...params,
		messages,
	};
}

async function resolvePrivateAssetImageUrlsInMessage({
	message,
	params,
	storageService,
	assetsUrl,
}: ResolvePrivateAssetImagesRequest & { message: Message }): Promise<Message> {
	if (!Array.isArray(message.content)) {
		return message;
	}

	const content = await Promise.all(
		message.content.map((part) =>
			resolvePrivateAssetImageUrlPart({
				part,
				params,
				storageService,
				assetsUrl,
			}),
		),
	);

	if (content.every((part, index) => part === message.content[index])) {
		return message;
	}

	return {
		...message,
		content,
	};
}

async function resolvePrivateAssetImageUrlPart({
	part,
	params,
	storageService,
	assetsUrl,
}: ResolvePrivateAssetImagesRequest & { part: MessageContent }): Promise<MessageContent> {
	if (part.type !== "image_url" || !part.image_url?.url) {
		return part;
	}

	const dataUrl = await resolvePrivateAssetImageUrl({
		url: part.image_url.url,
		params,
		storageService,
		assetsUrl,
	});

	if (dataUrl === part.image_url.url) {
		return part;
	}

	return {
		...part,
		image_url: {
			...part.image_url,
			url: dataUrl,
		},
	};
}

async function resolvePrivateAssetImageUrl({
	url,
	params,
	storageService,
	assetsUrl,
}: ResolvePrivateAssetImagesRequest & { url: string }): Promise<string> {
	if (url.startsWith("data:")) {
		return url;
	}

	const user = resolveRequestUser(params);
	return (await storageService.getPrivateAssetImageDataUrl(url, user?.id, assetsUrl)) ?? url;
}
