import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateFileResourceFromUrl } from "~/infrastructure/storage/resource-urls";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { createSource } from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { publishSourceChanged, updateSourceRecord } from "../media/metadata";

const EXTENSION_MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  flac: "audio/flac",
};

interface GeneratedMedia {
  data: ArrayBuffer;
  mimeType: string;
  extension: string;
  /** Removes the provider's transient copy once the source holds its own. */
  release?: () => Promise<void>;
}

export function collectGeneratedUrls(value: unknown, urls: string[] = []): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^(?:https?:\/\/|\/(?:outputs|sources)\/)/i.test(trimmed) && !urls.includes(trimmed)) {
      urls.push(trimmed);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectGeneratedUrls(item, urls);
    }
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) {
      collectGeneratedUrls(item, urls);
    }
  }

  return urls;
}

export function readGeneratedText(response: unknown): string | null {
  if (typeof response === "string") {
    return response.trim() || null;
  }

  if (Array.isArray(response)) {
    const parts = response.filter((item): item is string => typeof item === "string");

    return parts.join("").trim() || null;
  }

  return null;
}

function extensionFromUrl(url: string): string | undefined {
  return url
    .split("?")[0]
    ?.match(/\.([a-z0-9]+)$/i)?.[1]
    ?.toLowerCase();
}

function mediaFrom(data: ArrayBuffer, mimeType: string | undefined, url: string): GeneratedMedia {
  const urlExtension = extensionFromUrl(url);
  const resolvedMimeType =
    mimeType?.split(";")[0] ||
    (urlExtension ? EXTENSION_MIME_TYPES[urlExtension] : undefined) ||
    "application/octet-stream";
  const extension =
    Object.entries(EXTENSION_MIME_TYPES).find(([, type]) => type === resolvedMimeType)?.[0] ??
    urlExtension ??
    "bin";

  return { data, mimeType: resolvedMimeType, extension };
}

async function adoptGeneratedMedia(
  context: ServiceContext,
  url: string,
): Promise<GeneratedMedia | null> {
  const resource = getPrivateFileResourceFromUrl(url, context.env.API_BASE_URL);

  if (resource?.kind === "output") {
    const outputs = context.repositories.get(OutputRepository);
    const output = await outputs.getOutput(resource.id);

    if (
      !output?.storage_key ||
      !ownsResource(context.requireUser().id, output.created_by_user_id)
    ) {
      return null;
    }

    const storage = StorageService.forPrivateAssets(context);
    const object = await storage.getObjectBody(output.storage_key);

    if (!object) {
      return null;
    }

    const storageKey = output.storage_key;

    return {
      ...mediaFrom(await object.arrayBuffer(), output.mime_type ?? undefined, url),
      release: async () => {
        await outputs.deleteOutput(output.id);
        await storage.deleteObject(storageKey);
      },
    };
  }

  if (resource || !/^https:\/\//i.test(url)) {
    return null;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new AssistantError(
      `Failed to fetch the generated media (${response.status})`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  return mediaFrom(
    await response.arrayBuffer(),
    response.headers.get("content-type") ?? undefined,
    url,
  );
}

async function storeGeneratedMedia(
  context: ServiceContext,
  source: SourceRecord,
  media: GeneratedMedia,
): Promise<SourceRecord> {
  const key = `sources/${source.id}/generation.${media.extension}`;
  const repository = context.repositories.get(SourceRepository);

  await StorageService.forPrivateAssets(context).uploadObject(key, media.data, {
    httpMetadata: { contentType: media.mimeType },
  });
  await repository.attachSourceFile(
    source.id,
    {
      storageKey: key,
      mimeType: media.mimeType,
      filename: `${source.id}.${media.extension}`,
      byteSize: media.data.byteLength,
    },
    { status: "available" },
  );

  const stored = await repository.getSource(source.id);

  if (!stored) {
    throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
  }

  await publishSourceChanged(context, stored);

  return stored;
}

export async function failSourceGeneration(
  context: ServiceContext,
  source: SourceRecord,
  error: string,
): Promise<SourceRecord> {
  return updateSourceRecord(context, source, {
    status: "failed",
    generation: { error },
    pending: null,
  });
}

/**
 * Moves what a model produced into the source itself. Media the provider already persisted as
 * transient outputs is copied into the source's own file and the transient output removed, so
 * generated media lives only in Sources. Extra media beyond the first becomes sibling sources.
 */
export async function finaliseSourceGeneration(
  context: ServiceContext,
  source: SourceRecord,
  providerResponse: Record<string, unknown>,
): Promise<SourceRecord> {
  try {
    return await adoptGeneration(context, source, providerResponse);
  } catch (error) {
    return failSourceGeneration(
      context,
      source,
      getErrorMessage(error, "The generated media could not be saved"),
    );
  }
}

async function adoptGeneration(
  context: ServiceContext,
  source: SourceRecord,
  providerResponse: Record<string, unknown>,
): Promise<SourceRecord> {
  const response = providerResponse.response ?? providerResponse.output;

  if (source.kind === "text") {
    const text = readGeneratedText(response);

    return text
      ? updateSourceRecord(context, source, { status: "available", content: text, pending: null })
      : failSourceGeneration(context, source, "The model returned no text");
  }

  const urls = collectGeneratedUrls(response);
  const media: GeneratedMedia[] = [];

  for (const url of urls) {
    const adopted = await adoptGeneratedMedia(context, url);

    if (adopted) {
      media.push(adopted);
    }
  }

  const [first, ...rest] = media;

  if (!first) {
    return failSourceGeneration(context, source, "The model returned no media");
  }

  const cleared = await updateSourceRecord(context, source, { pending: null });
  const stored = await storeGeneratedMedia(context, cleared, first);
  const metadata = parseJsonRecord(stored.metadata);

  for (const extra of rest) {
    const sibling = await createSource(context, stored.created_by_user_id, {
      projectId: stored.project_id,
      kind: "file",
      title: stored.title,
      status: "processing",
      metadata,
    });
    const siblingRecord = await context.repositories.get(SourceRepository).getSource(sibling.id);

    if (siblingRecord) {
      await storeGeneratedMedia(context, siblingRecord, extra);
    }
  }

  await Promise.all(media.map((item) => item.release?.()));

  return stored;
}
