import { sanitiseInput } from "~/lib/chat/utils";
import { getSpeechProvider } from "~/lib/providers/capabilities/speech";
import { generateWithProviderFallback } from "~/lib/providers/capabilities/utils";
import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { resolveModelProvider } from "~/lib/providers/models";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { hasUserProviderApiKey } from "~/lib/providers/utils/apiKeys";

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

		const providerName = await resolveModelProvider({
			provider: args.provider,
			model: args.model,
			defaultProvider: DEFAULT_PROVIDER,
			env: runtimeEnv,
		});
		if (
			runtimeUser.plan_id !== "pro" &&
			!(await hasUserProviderApiKey({
				env: runtimeEnv,
				user: runtimeUser,
				providerName,
			}))
		) {
			throw new AssistantError(
				`Speech generation requires a configured ${providerName} provider key`,
				ErrorType.AUTHORISATION_ERROR,
				403,
			);
		}
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

		const speechData = await generateWithProviderFallback({
			providerName,
			defaultProvider: DEFAULT_PROVIDER,
			request,
			getProvider: (name) =>
				getSpeechProvider(name, {
					env: runtimeEnv,
					user: runtimeUser,
				}),
			allowFallback: runtimeUser.plan_id === "pro",
		});

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
			content: error instanceof Error ? error.message : "Failed to generate speech",
			data: {},
		};
	}
}
