import { sanitiseInput } from "~/lib/chat/utils";
import { type imagePrompts } from "~/lib/prompts/image";
import { getImageProvider } from "~/lib/providers/capabilities/image";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { getModelConfigByModel } from "~/lib/providers/models";
import type { IEnv, IUser } from "~/types";

export interface ImageGenerationParams {
	prompt: string;
	image_style?: keyof typeof imagePrompts;
	steps?: number;
	provider?: string;
	model?: string;
	aspect_ratio?: string;
	width?: number;
	height?: number;
}

export interface ImageResponse {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
}

const DEFAULT_PROVIDER = "workers-ai";

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

export async function generateImage({
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
	args: ImageGenerationParams;
	user: IUser;
}): Promise<ImageResponse> {
	if (!args.prompt) {
		return {
			status: "error",
			name: "create_image",
			content: "Missing prompt",
			data: {},
		};
	}

	try {
		const serviceContext = resolveServiceContext({ context, env, user });
		const runtimeEnv = serviceContext.env;
		const runtimeUser = serviceContext.user ?? user;

		const sanitisedPrompt = sanitiseInput(args.prompt);

		const diffusionSteps =
			args.steps === undefined || args.steps === 0 ? 4 : args.steps;

		if (diffusionSteps < 1 || diffusionSteps > 8) {
			return {
				status: "error",
				name: "create_image",
				content: "Invalid number of diffusion steps",
				data: {},
			};
		}

		const providerName = await resolveProviderName(args.provider, args.model);
		const provider = getImageProvider(providerName, {
			env: runtimeEnv,
			user: runtimeUser,
		});

		const request = {
			prompt: sanitisedPrompt,
			env: runtimeEnv,
			user: runtimeUser,
			completion_id,
			app_url,
			style: args.image_style,
			aspectRatio: args.aspect_ratio,
			width: args.width,
			height: args.height,
			steps: diffusionSteps,
			model: args.model,
			metadata: {
				steps: diffusionSteps,
			},
		};

		let imageData;
		try {
			imageData = await provider.generate(request);
		} catch (error) {
			if (providerName !== DEFAULT_PROVIDER && !args.model) {
				const fallbackProvider = getImageProvider(DEFAULT_PROVIDER, {
					env: runtimeEnv,
					user: runtimeUser,
				});
				imageData = await fallbackProvider.generate(request);
			} else {
				throw error;
			}
		}

		return {
			status: "success",
			name: "create_image",
			content: "Image generated successfully",
			data: imageData,
		};
	} catch (error) {
		return {
			status: "error",
			name: "create_image",
			content:
				error instanceof Error ? error.message : "Failed to generate image",
			data: {},
		};
	}
}
