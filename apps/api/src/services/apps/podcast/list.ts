import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "../../../utils/json";

export interface IPodcastListRequest {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
}

export interface IPodcast {
	id: string;
	title: string;
	description?: string;
	createdAt: string;
	imageUrl?: string;
	audioUrl?: string;
	duration?: number;
	transcript?: string;
	summary?: string;
	status: "processing" | "transcribing" | "summarizing" | "complete";
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

export const handlePodcastList = async (
	req: IPodcastListRequest,
): Promise<IPodcast[]> => {
	const { env, context, user } = req;

	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}
	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const repositories = serviceContext.repositories;

	const appDataList = await repositories.appData.getAppDataByUserAndApp(
		user.id,
		"podcasts",
	);

	if (!appDataList || appDataList.length === 0) {
		return [];
	}

	const podcastMap = new Map<string, PodcastItem>();

	for (const appData of appDataList) {
		if (!appData.item_id) continue;

		const itemId = appData.item_id;
		const itemType = appData.item_type || "unknown";
		let data = safeParseJson(appData.data);

		if (!podcastMap.has(itemId)) {
			podcastMap.set(itemId, { id: itemId, items: {} });
		}

		const podcast = podcastMap.get(itemId)!;
		if (!podcast.items) podcast.items = {};
		if (!podcast.items[itemType]) podcast.items[itemType] = [];

		podcast.items[itemType]!.push({ data });
	}

	const podcasts = Array.from(podcastMap.values()).map((podcast) => {
		const uploads = podcast.items?.upload || [];
		const transcriptions = podcast.items?.transcribe || [];
		const summaries = podcast.items?.summary || [];
		const images = podcast.items?.image || [];

		let status = "processing" as IPodcast["status"];
		if (images.length > 0) {
			status = "complete";
		} else if (summaries.length > 0) {
			status = "summarizing";
		} else if (transcriptions.length > 0) {
			status = "transcribing";
		}

		const uploadData = uploads[0]?.data || {};

		return {
			id: podcast.id,
			title: uploadData.title || "Untitled Podcast",
			createdAt: uploadData.createdAt || new Date().toISOString(),
			imageUrl: images[0]?.data?.imageUrl,
			duration: uploadData.duration,
			status,
		};
	});

	return podcasts;
};
