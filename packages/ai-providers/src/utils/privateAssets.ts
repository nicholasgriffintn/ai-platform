import type { ProviderStorage } from "../host.js";
import { resolveRequestUser } from "../request-user.js";
import type { ChatCompletionParameters, Message, MessageContent } from "../types/index.js";

interface ResolvePrivateAssetsRequest {
  params: ChatCompletionParameters;
  storageService: ProviderStorage;
  assetsUrl?: string;
}

export async function resolvePrivateAssetUrls({
  params,
  storageService,
  assetsUrl,
}: ResolvePrivateAssetsRequest): Promise<ChatCompletionParameters> {
  const original = params.messages ?? [];
  const messages = await Promise.all(
    original.map((message) => resolveMessageAssets({ message, params, storageService, assetsUrl })),
  );

  return messages.every((message, index) => message === original[index])
    ? params
    : { ...params, messages };
}

async function resolveMessageAssets({
  message,
  ...request
}: ResolvePrivateAssetsRequest & { message: Message }): Promise<Message> {
  const parts = message.content;

  if (!Array.isArray(parts)) {
    return message;
  }

  const content = await Promise.all(parts.map((part) => resolveAssetPart({ part, ...request })));

  return content.every((part, index) => part === parts[index]) ? message : { ...message, content };
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
  storageService: ProviderStorage,
  userId: number | undefined,
  assetsUrl: string | undefined,
  options: { allowedMimePrefixes?: string[]; allowedMimeTypes?: string[] },
): Promise<string> {
  if (url.startsWith("data:")) {
    return url;
  }

  return (await storageService.getPrivateAssetDataUrl(url, userId, assetsUrl, options)) ?? url;
}
