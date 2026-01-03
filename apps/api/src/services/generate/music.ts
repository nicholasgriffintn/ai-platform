import { sanitiseInput } from "~/lib/chat/utils";
import { getMusicProvider } from "~/lib/providers/capabilities/music";
import { getModelConfigByModel } from "~/lib/providers/models";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";

export interface MusicGenerationParams {
	prompt: string;
	input_audio?: string;
	duration?: number;
	provider?: string;
	model?: string;
}

export interface MusicResponse {
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

		const providerName = await resolveProviderName(args.provider, args.model);
		const provider = getMusicProvider(providerName, {
			env: runtimeEnv,
			user: runtimeUser,
		});

		const request = {
			prompt: sanitisedPrompt,
			env: runtimeEnv,
			user: runtimeUser,
			completion_id,
			app_url,
			inputAudio: args.input_audio,
			duration: args.duration,
			model: args.model,
		};

		let musicData;
		try {
			musicData = await provider.generate(request);
		} catch (error) {
			if (providerName !== DEFAULT_PROVIDER && !args.model) {
				const fallbackProvider = getMusicProvider(DEFAULT_PROVIDER, {
					env: runtimeEnv,
					user: runtimeUser,
				});
				musicData = await fallbackProvider.generate(request);
			} else {
				throw error;
			}
		}

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
