import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { chapterAudioKey } from "~/modules/discover/domain/episodes";
import { DISCOVER_LISTEN_SHOW } from "~/modules/discover/domain/listen";
import { joinAudioSegments } from "~/modules/sources/application/podcasts/audio";
import { ensurePodcastShow } from "~/modules/sources/application/podcasts/shows";
import { addCollectionSources, createSource } from "~/modules/sources/application/sources";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { enqueueDiscoverJob } from "./covers";
import { requireDiscoverEpisode, requireDiscoverSeason } from "./episodes";

export async function queueSeasonListen(
  context: ServiceContext,
  seasonId: string,
): Promise<{ queued: true }> {
  await requireDiscoverSeason(context, seasonId);
  await enqueueDiscoverJob(context, { job: "season_listen", seasonId });

  return { queued: true };
}

export async function produceSeasonListen(context: ServiceContext, seasonId: string) {
  const user = context.requireUser();
  const season = await requireDiscoverSeason(context, seasonId);
  const storage = StorageService.forPrivateAssets(context);
  const segments: Uint8Array[] = [];

  for (const episodeId of season.episodeIds) {
    const { content } = await requireDiscoverEpisode(context, episodeId);

    for (const [index, chapter] of content.chapters.entries()) {
      const object =
        chapter.status === "ready"
          ? await storage.getObjectBody(chapterAudioKey(episodeId, index))
          : null;

      if (object) {
        segments.push(new Uint8Array(await object.arrayBuffer()));
      }
    }
  }

  if (segments.length === 0) {
    throw new AssistantError(
      "No chapters of this season are ready yet",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const audio = joinAudioSegments(segments);
  const showId = await ensurePodcastShow(context, user.id, null, DISCOVER_LISTEN_SHOW);
  const source = await createSource(context, user.id, {
    projectId: null,
    kind: "podcast",
    title: `${season.title}: the whole season`,
    status: "processing",
    metadata: {},
  });
  const key = `sources/${source.id}/episode.mp3`;

  await storage.uploadObject(key, audio, { httpMetadata: { contentType: "audio/mpeg" } });
  await context.repositories.get(SourceRepository).attachSourceFile(
    source.id,
    {
      storageKey: key,
      mimeType: "audio/mpeg",
      filename: "season.mp3",
      byteSize: audio.byteLength,
    },
    { status: "available" },
  );
  await addCollectionSources(context, user.id, showId, [source.id]);

  return source.id;
}
