import { gatewayId } from "~/constants/app";
import { StorageService } from "~/lib/storage";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/podcast/generate-image" });

export interface IPodcastGenerateImageBody {
	podcastId: string;
}

type GenerateImageRequest = {
	context?: ServiceContext;
	env?: IEnv;
	request: IPodcastGenerateImageBody;
	user: IUser;
	app_url?: string;
};

export const handlePodcastGenerateImage = async (
	req: GenerateImageRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
	const { request, context, env, user } = req;

	if (!request.podcastId) {
		throw new AssistantError("Missing podcast id", ErrorType.PARAMS_ERROR);
	}

	try {
		if (!user?.id) {
			throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
		}

		const serviceContext = resolveServiceContext({ context, env, user });
		serviceContext.ensureDatabase();
		const repositories = serviceContext.repositories;
		const runtimeEnv = serviceContext.env as IEnv;

		const existingImages =
			await repositories.appData.getAppDataByUserAppAndItem(
				user.id,
				"podcasts",
				request.podcastId,
				"image",
			);

		if (existingImages.length > 0) {
			let imageData;
			try {
				imageData = JSON.parse(existingImages[0].data);
			} catch (e) {
				logger.error("Failed to parse image data", { error: e });
				imageData = {};
			}
			return {
				status: "success",
				content: `Podcast Featured Image: [${imageData.imageId}](${imageData.imageUrl})`,
				data: {
					imageUrl: imageData.imageUrl,
					imageKey: imageData.imageKey,
				},
			};
		}

		const summaryData = await repositories.appData.getAppDataByUserAppAndItem(
			user.id,
			"podcasts",
			request.podcastId,
			"summary",
		);

		if (summaryData.length === 0) {
			throw new AssistantError(
				"Podcast summary not found. Please summarize podcast first",
			);
		}

		let parsedSummaryData;
		try {
			parsedSummaryData = JSON.parse(summaryData[0].data);
		} catch (e) {
			logger.error("Failed to parse summary data", { error: e });
			parsedSummaryData = {};
		}

		const summaryContent =
			parsedSummaryData.summary || parsedSummaryData.description;
		const summary = `I need a featured image for my latest podcast episode, this is the summary: ${summaryContent}`;

		const data = await runtimeEnv.AI.run(
			"@cf/bytedance/stable-diffusion-xl-lightning",
			{
				prompt: summary,
			},
			{
				gateway: {
					id: gatewayId,
					skipCache: false,
					cacheTtl: 3360,
					metadata: {
						email: user?.email,
					},
				},
			},
		);

		if (!data) {
			throw new AssistantError("Image not generated");
		}

		const imageId = generateId();
		const imageKey = `podcasts/${imageId}/featured.png`;

		const reader = data.getReader();
		const chunks = [];
		let done = false;
		while (!done) {
			const result = await reader.read();
			done = result.done;
			if (result.value) {
				chunks.push(result.value);
			}
		}
		const arrayBuffer = new Uint8Array(
			chunks.reduce(
				(acc: number[], chunk) => acc.concat(Array.from(chunk)),
				[] as number[],
			),
		).buffer;
		const length = arrayBuffer.byteLength;

		const storageService = new StorageService(runtimeEnv.ASSETS_BUCKET);
		await storageService.uploadObject(imageKey, arrayBuffer, {
			contentType: "image/png",
			contentLength: length,
		});

		const baseAssetsUrl = runtimeEnv.PUBLIC_ASSETS_URL || "";
		const imageUrl = `${baseAssetsUrl}/${imageKey}`;

		const appData = {
			imageId,
			imageKey,
			imageUrl,
			summary: summaryContent,
			status: "complete",
			createdAt: new Date().toISOString(),
		};

		await repositories.appData.createAppDataWithItem(
			user.id,
			"podcasts",
			request.podcastId,
			"image",
			appData,
		);

		return {
			status: "success",
			content: `Podcast Featured Image Uploaded: [${imageId}](${imageUrl})`,
			data: appData,
		};
	} catch (error) {
		logger.error("Failed to generate podcast image:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		throw new AssistantError("Failed to generate podcast image");
	}
};
