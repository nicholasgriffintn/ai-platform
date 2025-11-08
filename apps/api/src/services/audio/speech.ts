import { StorageService } from "~/lib/storage";
import { getAudioProvider } from "~/lib/providers/capabilities/audio";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { sanitiseInput } from "../../lib/chat/utils";

type TextToSpeechRequest = {
	env: IEnv;
	input: string;
	user: IUser;
	provider?: "polly" | "cartesia" | "elevenlabs" | "melotts";
	lang?: string;
};

export const handleTextToSpeech = async (
	req: TextToSpeechRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
	const { input: rawInput, env, user, provider = "polly", lang = "en" } = req;

	const input = sanitiseInput(rawInput);

	if (!input) {
		throw new AssistantError("Missing input", ErrorType.PARAMS_ERROR);
	}

	if (input.length > 4096) {
		throw new AssistantError("Input is too long", ErrorType.PARAMS_ERROR);
	}

	const storage = new StorageService(env.ASSETS_BUCKET);
	const slug = `tts/${encodeURIComponent(user?.email || "unknown").replace(/[^a-zA-Z0-9]/g, "-")}-${generateId()}`;

	const audioProvider = getAudioProvider(provider, { env, user });
	const synthesisResult = await audioProvider.synthesize({
		input,
		env,
		user,
		slug,
		storage,
		locale: lang,
	});

	if (!synthesisResult) {
		throw new AssistantError("No response from the text-to-speech service");
	}

	const audioKey = synthesisResult.key;

	const baseAssetsUrl = env.PUBLIC_ASSETS_URL || "";
	const normalizedKey = audioKey?.replace(/^\//, "");
	const audioUrl =
		synthesisResult.url ||
		(normalizedKey
			? baseAssetsUrl
				? `${baseAssetsUrl.replace(/\/$/, "")}/${normalizedKey}`
				: `/${normalizedKey}`
			: undefined);
	const responseText = synthesisResult.response;
	const linkText = audioUrl ? `[Listen to the audio](${audioUrl})` : undefined;

	let content: string;
	if (responseText && linkText) {
		content = `${responseText}\n${linkText}`;
	} else if (responseText) {
		content = responseText;
	} else if (audioKey) {
		content = audioKey;
	} else if (linkText) {
		content = linkText;
	} else {
		content = "Audio generated successfully";
	}

	return {
		status: "success",
		content,
		data: {
			provider,
			audioKey,
			audioUrl,
			response: responseText,
			metadata: synthesisResult.metadata,
		},
	};
};
