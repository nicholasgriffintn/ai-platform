import { getSourceMediaType } from "@ngriffin_uk/polychat-schemas";
import { randomHex } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { readSourceCoverObject } from "~/modules/sources/application/media/cover";
import { readSourceRecordMedia } from "~/modules/sources/application/media/metadata";
import { requireCollectionAccess } from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceCollectionRecord,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { recordProjectAudit } from "~/modules/workspaces/application/audit";

import { buildPodcastFeed } from "./rss";

const FEED_PATH = "/sources/collections/shared";

export function podcastFeedUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}${FEED_PATH}/${token}`;
}

async function requireShow(
  context: ServiceContext,
  userId: number,
  collectionId: string,
): Promise<SourceCollectionRecord> {
  const show = await requireCollectionAccess(context, userId, collectionId, true);

  if (show.kind !== "podcast") {
    throw new AssistantError("Only podcast shows have feeds", ErrorType.PARAMS_ERROR, 400);
  }

  return show;
}

/** Issues a new private feed link for a show. Any earlier link stops working. */
export async function enablePodcastFeed(
  context: ServiceContext,
  userId: number,
  collectionId: string,
  baseUrl: string,
): Promise<{ url: string }> {
  const show = await requireShow(context, userId, collectionId);
  const token = randomHex(32);

  await context.repositories
    .get(SourceRepository)
    .setCollectionFeedTokenHash(show.id, await sha256Hex(token));

  if (show.project_id) {
    await recordProjectAudit(context, show.project_id, {
      actorUserId: userId,
      action: "source.feed.created",
      targetType: "source_collection",
      targetId: show.id,
    });
  }

  return { url: podcastFeedUrl(baseUrl, token) };
}

export async function disablePodcastFeed(
  context: ServiceContext,
  userId: number,
  collectionId: string,
): Promise<void> {
  const show = await requireShow(context, userId, collectionId);

  await context.repositories.get(SourceRepository).setCollectionFeedTokenHash(show.id, null);

  if (show.project_id) {
    await recordProjectAudit(context, show.project_id, {
      actorUserId: userId,
      action: "source.feed.revoked",
      targetType: "source_collection",
      targetId: show.id,
    });
  }
}

function isPublishedEpisode(source: SourceRecord): boolean {
  return (
    source.status === "available" &&
    Boolean(source.storage_key) &&
    getSourceMediaType(source.mime_type) === "audio"
  );
}

async function resolveFeed(context: ServiceContext, token: string) {
  const repository = context.repositories.get(SourceRepository);
  const show = await repository.getCollectionByFeedTokenHash(await sha256Hex(token));

  if (!show) {
    throw new AssistantError("Feed not found", ErrorType.NOT_FOUND, 404);
  }

  const episodes = (await repository.listCollectionSources(show.id)).filter(isPublishedEpisode);

  return { show, episodes };
}

export async function readPodcastFeed(
  context: ServiceContext,
  token: string,
  baseUrl: string,
): Promise<Response> {
  const { show, episodes } = await resolveFeed(context, token);
  const owner = await context.repositories.get(UserRepository).getUserById(show.created_by_user_id);
  const feedUrl = podcastFeedUrl(baseUrl, token);
  const latestCover = episodes.find((episode) => readSourceRecordMedia(episode).cover);
  const xml = buildPodcastFeed({
    title: show.title,
    description: show.description ?? `${show.title}, made with Polychat.`,
    link: feedUrl,
    feedUrl,
    author: owner?.name ?? "Polychat",
    language: "en",
    imageUrl: latestCover ? `${feedUrl}/${latestCover.id}/cover` : undefined,
    episodes: episodes.map((episode) => {
      const media = readSourceRecordMedia(episode);

      return {
        id: episode.id,
        title: episode.title,
        description: media.notes?.summary ?? episode.title,
        publishedAt: episode.created_at,
        audioUrl: `${feedUrl}/${episode.id}`,
        mimeType: episode.mime_type ?? "audio/mpeg",
        byteSize: episode.byte_size ?? 0,
        durationSeconds: media.durationSeconds,
        imageUrl: media.cover ? `${feedUrl}/${episode.id}/cover` : undefined,
      };
    }),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function readPodcastFeedFile(
  context: ServiceContext,
  token: string,
  sourceId: string,
  part: "audio" | "cover",
): Promise<Response> {
  const { episodes } = await resolveFeed(context, token);
  const episode = episodes.find((candidate) => candidate.id === sourceId);

  if (!episode?.storage_key) {
    throw new AssistantError("Episode not found", ErrorType.NOT_FOUND, 404);
  }

  if (part === "cover") {
    return readSourceCoverObject(context, episode);
  }

  const object = await StorageService.forPrivateAssets(context).getObjectBody(episode.storage_key);

  if (!object) {
    throw new AssistantError("Episode not found", ErrorType.NOT_FOUND, 404);
  }

  return new Response(await object.arrayBuffer(), {
    headers: {
      "Content-Type": episode.mime_type ?? "audio/mpeg",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
