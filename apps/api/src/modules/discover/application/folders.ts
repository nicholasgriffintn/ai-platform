import {
  DISCOVER_EPISODE_KIND,
  DISCOVER_EPISODES_CAPABILITY_ID,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  DISCOVER_EPISODES_FOLDER,
  DISCOVER_RESEARCH_FOLDER,
} from "~/modules/discover/domain/folders";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { ensureFolder } from "~/modules/sources/application/folders";

export async function fileDiscoverEpisode(
  context: ServiceContext,
  episodeId: string,
): Promise<void> {
  const user = context.requireUser();
  const outputs = context.repositories.get(OutputRepository);
  const folder = await ensureFolder(context, user.id, {
    projectId: null,
    title: DISCOVER_EPISODES_FOLDER,
    kind: "general",
  });
  const earlier = folder.created
    ? await outputs.listPersonalOutputs(user.id, DISCOVER_EPISODES_CAPABILITY_ID, {
        kind: DISCOVER_EPISODE_KIND,
        limit: 200,
      })
    : [];

  await outputs.linkOutputs(folder.id, [
    episodeId,
    ...earlier.map((episode) => episode.id).filter((id) => id !== episodeId),
  ]);
}

export async function ensureDiscoverResearchFolder(context: ServiceContext): Promise<string> {
  const folder = await ensureFolder(context, context.requireUser().id, {
    projectId: null,
    title: DISCOVER_RESEARCH_FOLDER,
    kind: "general",
  });

  return folder.id;
}
