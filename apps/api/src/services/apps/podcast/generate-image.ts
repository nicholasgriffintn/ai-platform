import { gatewayId } from "~/constants/app";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "../../../utils/json";

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
	projectId?: string;
};

export const handlePodcastGenerateImage = async (
	req: GenerateImageRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
	const { request, context, env, user, projectId } = req;

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

		const existingImages = projectId
			? await repositories.outputs.listProjectOutputGroup(
					projectId,
					"podcasts",
					request.podcastId,
					"image",
				)
			: await repositories.outputs.listPersonalOutputGroup(
					user.id,
					"podcasts",
					request.podcastId,
					"image",
				);

		if (existingImages.length > 0) {
			const imageData = safeParseJson<Record<string, any>>(existingImages[0].content) ?? {};
			return {
				status: "success",
				content: `Podcast Featured Image: [${imageData.imageId}](${imageData.imageUrl})`,
				data: {
					imageUrl: imageData.imageUrl,
					imageKey: imageData.imageKey,
				},
			};
		}

		const summaryData = projectId
			? await repositories.outputs.listProjectOutputGroup(
					projectId,
					"podcasts",
					request.podcastId,
					"summary",
				)
			: await repositories.outputs.listPersonalOutputGroup(
					user.id,
					"podcasts",
					request.podcastId,
					"summary",
				);

		if (summaryData.length === 0) {
			throw new AssistantError("Podcast summary not found. Please summarize podcast first");
		}

		const parsedSummaryData = safeParseJson<Record<string, any>>(summaryData[0].content) ?? {};
		const summaryContent = parsedSummaryData.summary || parsedSummaryData.description;
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
			chunks.reduce((acc: number[], chunk) => acc.concat(Array.from(chunk)), [] as number[]),
		).buffer;
		const length = arrayBuffer.byteLength;

		const appData: Record<string, unknown> = {
			imageId,
			imageKey,
			summary: summaryContent,
			status: "complete",
			createdAt: new Date().toISOString(),
		};

		const storedImage = await StorageService.forPrivateAssets(serviceContext).storeOutputFile({
			key: imageKey,
			data: arrayBuffer,
			createdByUserId: user.id,
			projectId,
			capabilityId: "podcasts",
			groupId: request.podcastId,
			kind: "image",
			title: "Podcast featured image",
			content: appData,
			mimeType: "image/png",
			filename: "featured.png",
			byteSize: length,
		});

		Object.assign(appData, {
			imageOutputId: storedImage.outputId,
			imageKey,
			imageUrl: storedImage.url,
		});
		const imageOutput = await repositories.outputs.getOutput(storedImage.outputId);
		if (imageOutput) {
			await repositories.outputs.updateOutput(imageOutput.id, {
				content: appData,
				expectedRevision: imageOutput.revision,
				updatedByUserId: user.id,
			});
		}

		return {
			status: "success",
			content: `Podcast Featured Image Uploaded: [${imageId}](${storedImage.url})`,
			data: appData,
		};
	} catch (error) {
		logger.error("Failed to generate podcast image:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		throw new AssistantError("Failed to generate podcast image");
	}
};
