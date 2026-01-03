import { sanitiseInput } from "~/lib/chat/utils";
import { getVideoProvider } from "~/lib/providers/capabilities/video";
import { getModelConfigByModel } from "~/lib/providers/models";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";

export interface VideoGenerationParams {
	prompt: string;
	negative_prompt?: string;
	guidance_scale?: number;
	video_length?: number;
	duration?: number;
	height?: number;
	width?: number;
	provider?: string;
	model?: string;
	aspect_ratio?: string;
}

export interface VideoResponse {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
}

const DEFAULT_PROVIDER = "replicate";

async function resolveProviderName(
	provider: string | undefined,
	model: string | undefined,
): Promise<string> {
	if (model) {
		const modelConfig = await getModelConfigByModel(model);
		if (modelConfig?.provider) {
			return modelConfig.provider;
		}
	}

	return provider || DEFAULT_PROVIDER;
}

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

		const providerName = await resolveProviderName(args.provider, args.model);
		const provider = getVideoProvider(providerName, {
			env: runtimeEnv,
			user: runtimeUser,
		});

		const request = {
			prompt: sanitisedPrompt,
			env: runtimeEnv,
			user: runtimeUser,
			completion_id,
			app_url,
			negativePrompt: args.negative_prompt,
			guidanceScale: args.guidance_scale,
			videoLength: args.video_length,
			duration: args.duration,
			height: args.height,
			width: args.width,
			aspectRatio: args.aspect_ratio,
			model: args.model,
		};

		let videoData;
		try {
			videoData = await provider.generate(request);
		} catch (error) {
			if (providerName !== DEFAULT_PROVIDER && !args.model) {
				const fallbackProvider = getVideoProvider(DEFAULT_PROVIDER, {
					env: runtimeEnv,
					user: runtimeUser,
				});
				videoData = await fallbackProvider.generate(request);
			} else {
				throw error;
			}
		}

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
