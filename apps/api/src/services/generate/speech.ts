import { sanitiseInput } from "~/lib/chat/utils";
import { getSpeechProvider } from "~/lib/providers/capabilities/speech";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { getModelConfigByModel } from "~/lib/providers/models";
import type { IEnv, IUser } from "~/types";

export interface SpeechGenerationParams {
	prompt: string;
	lang?: string;
	provider?: string;
	model?: string;
	voice?: string;
}

export interface SpeechResponse {
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

export async function generateSpeech({
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
	args: SpeechGenerationParams;
	user: IUser;
}): Promise<SpeechResponse> {
	if (!args.prompt) {
		return {
			status: "error",
			name: "create_speech",
			content: "Missing prompt",
			data: {},
		};
	}

	try {
		const serviceContext = resolveServiceContext({ context, env, user });
		const runtimeEnv = serviceContext.env;
		const runtimeUser = serviceContext.user ?? user;

		const sanitisedPrompt = sanitiseInput(args.prompt);

		const providerName = await resolveProviderName(args.provider, args.model);
		const provider = getSpeechProvider(providerName, {
			env: runtimeEnv,
			user: runtimeUser,
		});

		const request = {
			prompt: sanitisedPrompt,
			env: runtimeEnv,
			user: runtimeUser,
			completion_id,
			app_url,
			locale: args.lang || "en",
			voice: args.voice,
			model: args.model,
		};

		let speechData;
		try {
			speechData = await provider.generate(request);
		} catch (error) {
			if (providerName !== DEFAULT_PROVIDER && !args.model) {
				const fallbackProvider = getSpeechProvider(DEFAULT_PROVIDER, {
					env: runtimeEnv,
					user: runtimeUser,
				});
				speechData = await fallbackProvider.generate(request);
			} else {
				throw error;
			}
		}

		return {
			status: "success",
			name: "create_speech",
			content: "Speech generated successfully",
			data: speechData,
		};
	} catch (error) {
		return {
			status: "error",
			name: "create_speech",
			content:
				error instanceof Error ? error.message : "Failed to generate speech",
			data: {},
		};
	}
}
