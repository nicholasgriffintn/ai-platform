import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IPodcast } from "./list";
import { safeParseJson } from "../../../utils/json";

export interface IPodcastDetailRequest {
	context?: ServiceContext;
	env?: IEnv;
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
	const { env, context, podcastId, user } = req;

	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const repositories = serviceContext.repositories;

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
		let data = safeParseJson(appData.data);

		if (!podcastData.items) podcastData.items = {};
		if (!podcastData.items[itemType]) podcastData.items[itemType] = [];

		podcastData.items[itemType]!.push({ data });
	}

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
			transcriptions.length > 0
				? transcriptions[0].data?.transcriptionData?.output
				: undefined,
		summary: summaries.length > 0 ? summaries[0].data.summary : undefined,
		status,
	};

	return podcast;
};
