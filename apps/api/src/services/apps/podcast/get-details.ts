import { RepositoryManager } from "~/repositories";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IPodcast } from "./list";

export interface IPodcastDetailRequest {
  env: IEnv;
  podcastId: string;
  user: IUser;
}

interface PodcastItem {
  id: string;
  items?: {
    upload?: Array<{ data: Record<string, any> }>;
    transcribe?: Array<{ data: Record<string, any> }>;
    summary?: Array<{ data: Record<string, any> }>;
    image?: Array<{ data: Record<string, any> }>;
  };
}

export const handlePodcastDetail = async (
  req: IPodcastDetailRequest,
): Promise<IPodcast> => {
  const { env, podcastId, user } = req;

  if (!user?.id) {
    throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
  }

  const repositories = RepositoryManager.getInstance(env);

  const appDataItems = await repositories.appData.getAppDataByUserAppAndItem(
    user.id,
    "podcasts",
    podcastId,
  );

  if (!appDataItems || appDataItems.length === 0) {
    throw new AssistantError("Podcast not found", ErrorType.NOT_FOUND);
  }

  const podcastData: PodcastItem = { id: podcastId, items: {} };

  for (const appData of appDataItems) {
    if (!appData.item_type) continue;

    const itemType = appData.item_type;
    const data = JSON.parse(appData.data);

    if (!podcastData.items) podcastData.items = {};
    if (!podcastData.items[itemType]) podcastData.items[itemType] = [];

    podcastData.items[itemType]!.push({ data });
  }

  console.log(JSON.stringify(podcastData, null, 2));

  const uploads = podcastData.items?.upload || [];
  const transcriptions = podcastData.items?.transcribe || [];
  const summaries = podcastData.items?.summary || [];
  const images = podcastData.items?.image || [];

  let status = "processing" as IPodcast["status"];
  if (images.length > 0) {
    status = "complete";
  } else if (summaries.length > 0) {
    status = "summarizing";
  } else if (transcriptions.length > 0) {
    status = "transcribing";
  }

  const uploadData = uploads[0]?.data || {};

  const podcast: IPodcast = {
    id: podcastData.id,
    title: uploadData.title || "Untitled Podcast",
    description: uploadData.description,
    createdAt: uploadData.createdAt || new Date().toISOString(),
    imageUrl: images.length > 0 ? images[0].data.imageUrl : undefined,
    audioUrl: uploadData.audioUrl,
    duration: uploadData.duration,
    transcript:
      transcriptions.length > 0 ? transcriptions[0].data.transcript : undefined,
    summary: summaries.length > 0 ? summaries[0].data.summary : undefined,
    status,
  };

  return podcast;
};
