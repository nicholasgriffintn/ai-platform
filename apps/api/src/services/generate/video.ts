import { sanitiseInput } from "~/lib/chat/utils";
import { getModelConfigByModel } from "~/lib/providers/models";
import { validateReplicatePayload } from "~/lib/providers/models/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IEnv, IUser } from "~/types";

export interface VideoGenerationParams {
	prompt: string;
	negative_prompt?: string;
	guidance_scale?: number;
	video_length?: number;
	duration?: number;
	height?: number;
	width?: number;
}

export interface VideoResponse {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
}

const MODEL_KEY = "replicate-zeroscope-v2-xl";

export async function generateVideo({
	completion_id,
	app_url,
	env,
	context,
	args,
	user,
}: {
	completion_id: string;
	app_url: string | undefined;
	env?: IEnv;
	context?: ServiceContext;
	args: VideoGenerationParams;
	user: IUser;
}): Promise<VideoResponse> {
	try {
		const serviceContext = resolveServiceContext({ context, env, user });
		const runtimeEnv = serviceContext.env;
		const runtimeUser = serviceContext.user ?? user;

		if (!args.prompt) {
			return {
				status: "error",
				name: "create_video",
				content: "Missing prompt",
				data: {},
			};
		}

		const sanitisedPrompt = sanitiseInput(args.prompt).trim();
		if (!sanitisedPrompt) {
			return {
				status: "error",
				name: "create_video",
				content: "Missing prompt",
				data: {},
			};
		}

		const modelConfig = await getModelConfigByModel(MODEL_KEY);

		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${MODEL_KEY}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		const replicatePayload = Object.fromEntries(
			Object.entries({
				prompt: sanitisedPrompt,
				negative_prompt: args.negative_prompt,
				guidance_scale: args.guidance_scale,
				duration: args.video_length ?? args.duration,
				height: args.height,
				width: args.width,
			}).filter(([, value]) => value !== undefined && value !== null),
		);

		validateReplicatePayload({
			payload: replicatePayload,
			schema: modelConfig.replicateInputSchema,
			modelName: modelConfig.name || MODEL_KEY,
		});

		const provider = getChatProvider(modelConfig.provider || "replicate", {
			env: runtimeEnv,
			user: runtimeUser,
		});

		const videoData = await provider.getResponse({
			completion_id,
			app_url,
			model: modelConfig.matchingModel,
			messages: [
				{
					role: "user",
					content: replicatePayload.prompt as string,
				},
			],
			body: {
				input: replicatePayload,
			},
			env: runtimeEnv,
			user: runtimeUser,
		});

		const isAsync = videoData?.status === "in_progress";

		return {
			status: "success",
			name: "create_video",
			content: isAsync
				? "Video generation in progress"
				: "Video generated successfully",
			data: videoData,
		};
	} catch (error) {
		return {
			status: "error",
			name: "create_video",
			content:
				error instanceof Error ? error.message : "Failed to generate video",
			data: {},
		};
	}
}
