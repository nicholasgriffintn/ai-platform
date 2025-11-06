import { TranscriptionProviderFactory } from "~/lib/transcription/factory";
import { getAuxiliarySpeechModel } from "~/lib/models";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { RepositoryManager } from "~/repositories";

export type TranscriptionProvider = "workers" | "mistral" | "replicate";

type TranscribeRequest = {
	env: IEnv;
	audio: File | Blob | string;
	user: IUser;
	provider?: TranscriptionProvider;
	timestamps?: boolean;
};

export const handleTranscribe = async (
	req: TranscribeRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
	const { audio, env, user, provider, timestamps = false } = req;

	if (!audio) {
		throw new AssistantError("Missing audio", ErrorType.PARAMS_ERROR);
	}

	try {
		let selectedProvider = provider;

		if (!selectedProvider) {
			const repositories = new RepositoryManager(env);
			const userSettings = user?.id
				? await repositories.userSettings.getUserSettings(user.id)
				: null;

			const speechModel = await getAuxiliarySpeechModel(env, userSettings);
			selectedProvider =
				speechModel.transcriptionProvider as TranscriptionProvider;
		}

		const transcriptionProvider =
			TranscriptionProviderFactory.getProvider(selectedProvider);

		const result = await transcriptionProvider.transcribe({
			env,
			audio,
			user,
			provider: selectedProvider,
			timestamps,
		});

		return {
			status: "success",
			content: result.text,
			data: result.data,
		};
	} catch (error) {
		if (error instanceof AssistantError) {
			throw error;
		}

		throw new AssistantError(
			`Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			ErrorType.EXTERNAL_API_ERROR,
		);
	}
};
