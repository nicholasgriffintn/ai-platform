import { sanitiseInput } from "~/lib/chat/utils";
import {
	getTextToImageSystemPrompt,
	type imagePrompts,
} from "~/lib/prompts/image";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { ErrorType } from "~/utils/errors";

export interface ImageGenerationParams {
	prompt: string;
	image_style: keyof typeof imagePrompts;
	steps: number;
}

export interface ImageResponse {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
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

		const provider = getChatProvider("workers-ai", {
			env: runtimeEnv,
			user: runtimeUser,
		});

		const sanitisedPrompt = sanitiseInput(args.prompt);

		const systemPrompt = getTextToImageSystemPrompt(args.image_style);
		const diffusionSteps = args.steps || 4;

		if (diffusionSteps < 1 || diffusionSteps > 8) {
			return {
				status: "error",
				name: "create_image",
				content: "Invalid number of diffusion steps",
				data: {},
			};
		}

		const imageData = await provider.getResponse({
			completion_id,
			model: "@cf/black-forest-labs/flux-1-schnell",
			app_url,
			messages: [
				{
					role: "user",
					// @ts-ignore
					content: [
						{
							type: "text",
							text: `${systemPrompt}\n\n${sanitisedPrompt}`,
						},
					],
				},
			],
			env: runtimeEnv,
			user: runtimeUser,
		});

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
