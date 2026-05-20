export const transcriptionProviderOptions = [
	{
		id: "workers",
		label: "Workers",
		models: [
			{ id: "whisper", label: "OpenAI Whisper" },
			{ id: "whisper-tiny", label: "OpenAI Whisper Tiny" },
		],
	},
	{
		id: "mistral",
		label: "Mistral",
		models: [{ id: "voxtral-mini", label: "Voxtral Mini" }],
	},
	{
		id: "replicate",
		label: "Replicate",
		models: [{ id: "replicate-whisper-diarization", label: "Whisper Diarization" }],
	},
] as const;

export type TranscriptionProviderId = (typeof transcriptionProviderOptions)[number]["id"];
export type TranscriptionModelOption =
	(typeof transcriptionProviderOptions)[number]["models"][number];
export type ResolvedTranscriptionSettings = {
	transcription_provider: TranscriptionProviderId;
	transcription_model: string;
};

const defaultTranscriptionProvider = transcriptionProviderOptions[0];

export function getTranscriptionProviderOption(provider?: string | null) {
	return (
		transcriptionProviderOptions.find((option) => option.id === provider) ??
		defaultTranscriptionProvider
	);
}

export function getTranscriptionModelOptions(provider?: string | null) {
	return getTranscriptionProviderOption(provider).models;
}

export function resolveTranscriptionSettings(
	provider?: string | null,
	model?: string | null,
): ResolvedTranscriptionSettings {
	const providerOption = getTranscriptionProviderOption(provider);
	const matchingModel = providerOption.models.find((option) => option.id === model);

	return {
		transcription_provider: providerOption.id,
		transcription_model: matchingModel?.id ?? providerOption.models[0].id,
	};
}
