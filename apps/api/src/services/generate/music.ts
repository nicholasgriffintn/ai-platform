import { sanitiseInput } from "~/lib/chat/utils";
import { getModelConfigByModel } from "~/lib/models";
import { validateReplicatePayload } from "~/lib/models/utils/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IEnv, IUser } from "~/types";

export interface MusicGenerationParams {
	prompt: string;
	input_audio?: string;
	duration?: number;
}

export interface MusicResponse {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
}

const MODEL_KEY = "replicate-musicgen";

export async function generateMusic({
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
	args: MusicGenerationParams;
	user: IUser;
}): Promise<MusicResponse> {
	try {
		const serviceContext = resolveServiceContext({ context, env, user });
		const runtimeEnv = serviceContext.env;
		const runtimeUser = serviceContext.user ?? user;

		if (!args.prompt) {
			return {
				status: "error",
				name: "create_music",
				content: "Missing prompt",
				data: {},
			};
		}

		const sanitisedPrompt = sanitiseInput(args.prompt).trim();
		if (!sanitisedPrompt) {
			return {
				status: "error",
				name: "create_music",
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
				input_audio: args.input_audio,
				duration: args.duration,
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

		const musicData = await provider.getResponse({
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

		return {
			status: "success",
			name: "create_music",
			content: "Music generated successfully",
			data: musicData,
		};
	} catch (error) {
		return {
			status: "error",
			name: "create_music",
			content:
				error instanceof Error ? error.message : "Failed to generate music",
			data: {},
		};
	}
}
