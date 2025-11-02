import { sanitiseInput } from "~/lib/chat/utils";
import { StorageService } from "~/lib/storage";
import { RepositoryManager } from "~/repositories";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export type UploadRequest = {
	env: IEnv;
	request: {
		audio?: File;
		audioUrl?: string;
		title?: string;
		description?: string;
	};
	user: IUser;
};

interface IPodcastUploadResponse extends IFunctionResponse {
	completion_id?: string;
}

export const handlePodcastUpload = async (
	req: UploadRequest,
): Promise<IPodcastUploadResponse> => {
	const { env, request, user } = req;

	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}

	const podcastId = generateId();
	const repositories = RepositoryManager.getInstance(env);
	const storageService = new StorageService(env.ASSETS_BUCKET);

	const sanitisedTitle = sanitiseInput(request.title);
	const sanitisedDescription = sanitiseInput(request.description);

	if (!request.audioUrl) {
		const podcastAudioKey = `podcasts/${podcastId}/recording.mp3`;

		const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";
		const audioUrl = `${baseAssetsUrl}/${podcastAudioKey}`;

		if (!request.audio) {
			throw new AssistantError("Missing audio", ErrorType.PARAMS_ERROR);
		}

		try {
			const arrayBuffer = await request.audio.arrayBuffer();
			const length = arrayBuffer.byteLength;

			await storageService.uploadObject(podcastAudioKey, arrayBuffer, {
				contentType: "audio/mpeg",
				contentLength: length,
			});
		} catch (_error) {
			throw new AssistantError(
				"Failed to upload podcast",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		const appData = {
			title: sanitisedTitle || "Untitled Podcast",
			description: sanitisedDescription,
			audioUrl,
			audioKey: podcastAudioKey,
			status: "ready",
			createdAt: new Date().toISOString(),
		};

		await repositories.appData.createAppDataWithItem(
			user.id,
			"podcasts",
			podcastId,
			"upload",
			appData,
		);

		return {
			status: "success",
			content: `Podcast Upload: [Listen Here](${audioUrl})`,
			completion_id: podcastId,
			data: appData,
		};
	}

	const appData = {
		title: sanitisedTitle || "Untitled Podcast",
		description: sanitisedDescription,
		audioUrl: request.audioUrl,
		status: "ready",
		createdAt: new Date().toISOString(),
	};

	await repositories.appData.createAppDataWithItem(
		user.id,
		"podcasts",
		podcastId,
		"upload",
		appData,
	);

	return {
		status: "success",
		content: `Podcast Upload: [Listen Here](${request.audioUrl})`,
		completion_id: podcastId,
		data: appData,
	};
};
