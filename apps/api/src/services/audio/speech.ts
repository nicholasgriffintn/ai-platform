import { StorageService } from "~/lib/storage";
import { getAudioProvider } from "~/lib/providers/capabilities/audio";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { RepositoryManager } from "~/repositories";
import { sanitiseInput } from "../../lib/chat/utils";
import type { AudioResponseFormat } from "~/lib/providers/capabilities/audio/formats";
import { prepareSpeechInput } from "./input";

export type SpeechProvider = "polly" | "cartesia" | "elevenlabs" | "melotts" | "mistral";

const defaultSpeechModelsByProvider: Record<SpeechProvider, string> = {
	polly: "Ruth",
	cartesia: "sonic-3.5",
	elevenlabs: "eleven_multilingual_v2",
	melotts: "@cf/myshell-ai/melotts",
	mistral: "82c99ee6-f932-423f-a4a3-d403c8914b8d",
};

type TextToSpeechRequest = {
	env: IEnv;
	input: string;
	user: IUser;
	provider?: SpeechProvider;
	model?: string;
	lang?: string;
	store?: boolean;
	voice_id?: string;
	ref_audio?: string;
	response_format?: AudioResponseFormat;
};

function isSpeechProvider(provider: unknown): provider is SpeechProvider {
	return (
		provider === "polly" ||
		provider === "cartesia" ||
		provider === "elevenlabs" ||
		provider === "melotts" ||
		provider === "mistral"
	);
}

async function resolveSpeechSettings({
	env,
	user,
	provider,
	model,
}: Pick<TextToSpeechRequest, "env" | "user" | "provider" | "model">): Promise<{
	provider: SpeechProvider;
	model: string;
}> {
	if (provider) {
		return {
			provider,
			model: model || defaultSpeechModelsByProvider[provider],
		};
	}

	const repositories = new RepositoryManager(env);
	const userSettings = user?.id ? await repositories.userSettings.getUserSettings(user.id) : null;
	const settingsProvider = userSettings?.speech_provider;
	const resolvedProvider = isSpeechProvider(settingsProvider) ? settingsProvider : "melotts";

	return {
		provider: resolvedProvider,
		model: userSettings?.speech_model || defaultSpeechModelsByProvider[resolvedProvider],
	};
}

export const handleTextToSpeech = async (
	req: TextToSpeechRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
	const { input: rawInput, env, user, provider, model, lang = "en", store = true } = req;

	const input = sanitiseInput(rawInput);

	if (!input) {
		throw new AssistantError("Missing input", ErrorType.PARAMS_ERROR);
	}

	const speechSettings = await resolveSpeechSettings({ env, user, provider, model });
	const preparedInput = prepareSpeechInput(input, speechSettings.provider);
	const storage = store ? new StorageService(env.ASSETS_BUCKET) : undefined;
	const slug = `tts/${encodeURIComponent(user?.email || "unknown").replace(/[^a-zA-Z0-9]/g, "-")}-${generateId()}`;

	const audioProvider = getAudioProvider(speechSettings.provider, { env, user });
	const synthesisResult = await audioProvider.synthesize({
		input: preparedInput.input,
		env,
		user,
		slug,
		storage,
		store,
		voice: req.voice_id ?? speechSettings.model,
		locale: lang,
		refAudio: req.ref_audio,
		responseFormat: req.response_format,
		metadata: preparedInput.metadata,
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
	const metadata =
		preparedInput.metadata || synthesisResult.metadata
			? {
					...preparedInput.metadata,
					...synthesisResult.metadata,
				}
			: undefined;
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
			provider: speechSettings.provider,
			model: speechSettings.model,
			audioKey,
			audioUrl,
			audioBase64: synthesisResult.audioBase64,
			audioDataUrl: synthesisResult.audioDataUrl,
			audioMimeType: synthesisResult.audioMimeType,
			response: responseText,
			metadata,
		},
	};
};
