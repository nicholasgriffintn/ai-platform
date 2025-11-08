import { sanitiseInput } from "~/lib/chat/utils";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";

export interface SpeechGenerationParams {
	prompt: string;
	lang?: string;
}

export interface SpeechResponse {
	status: "success" | "error";
	name: string;
	content: string;
	data: any;
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

		const provider = getChatProvider("workers-ai", {
			env: runtimeEnv,
			user: runtimeUser,
		});

		const sanitisedPrompt = sanitiseInput(args.prompt);

		const speechData = await provider.getResponse({
			completion_id,
			model: "@cf/myshell-ai/melotts",
			app_url,
			messages: [
				{
					role: "user",
					// @ts-ignore
					content: [
						{
							type: "text",
							text: sanitisedPrompt,
						},
					],
				},
			],
			lang: args.lang || "en",
			env: runtimeEnv,
			user: runtimeUser,
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
			content:
				error instanceof Error ? error.message : "Failed to generate speech",
			data: {},
		};
	}
}
