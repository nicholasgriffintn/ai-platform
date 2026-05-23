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

export const speechProviderOptions = [
	{
		id: "melotts",
		label: "MeloTTS",
		models: [{ id: "@cf/myshell-ai/melotts", label: "MeloTTS" }],
	},
	{
		id: "polly",
		label: "Amazon Polly",
		models: [{ id: "Ruth", label: "Ruth" }],
	},
	{
		id: "cartesia",
		label: "Cartesia",
		models: [{ id: "sonic-3", label: "Sonic 3" }],
	},
	{
		id: "elevenlabs",
		label: "ElevenLabs",
		models: [{ id: "eleven_multilingual_v2", label: "Multilingual v2" }],
	},
	{
		id: "mistral",
		label: "Mistral",
		models: [
			{ id: "82c99ee6-f932-423f-a4a3-d403c8914b8d", label: "Jane - Neutral" },
			{ id: "e3596645-b1af-469e-b857-f18ddedc7652", label: "Oliver - Neutral" },
			{ id: "c69964a6-ab8b-4f8a-9465-ec0925096ec8", label: "Paul - Neutral" },
			{ id: "5a271406-039d-46fe-835b-fbbb00eaf08d", label: "Marie - Neutral" },
			{ id: "01d985cd-5e0c-4457-bfd8-80ba31a5bc03", label: "Paul - Cheerful" },
			{ id: "98559b22-62b5-4a64-a7cd-fc78ca41faa8", label: "Paul - Confident" },
			{ id: "5940190b-f58a-4c3e-8264-a40d63fd6883", label: "Paul - Excited" },
			{ id: "1f017bcb-02e5-460d-989b-db065c0c6122", label: "Paul - Frustrated" },
			{ id: "1024d823-a11e-43ee-bf3d-d440dccc0577", label: "Paul - Happy" },
			{ id: "530e2e20-58e2-45d8-b0a5-4594f4915944", label: "Paul - Sad" },
			{ id: "cb891218-482c-4392-9878-91e8d999d57a", label: "Paul - Angry" },
			{ id: "5ad5d44e-6b4e-4a57-a8a8-4cae088034ed", label: "Oliver - Cheerful" },
			{ id: "8169ab87-bc99-4669-a5ec-6855860ace24", label: "Oliver - Confident" },
			{ id: "390c8a2b-60a6-4882-8437-c49a8bd33b63", label: "Oliver - Curious" },
			{ id: "e8e5b1de-493c-4061-8414-e2170f9f4b6f", label: "Oliver - Excited" },
			{ id: "d4101b8f-12c3-450d-a812-7d700b3a3245", label: "Oliver - Sad" },
			{ id: "862274a7-8333-48f7-b668-f19c932999e0", label: "Oliver - Angry" },
			{ id: "cbe96cf0-85ec-4a10-accb-0b35c93b6dfd", label: "Jane - Confident" },
			{ id: "5de47977-6e47-4266-a938-3bc1d76b4676", label: "Jane - Curious" },
			{ id: "60844938-221d-4d1e-8233-34203f787d9f", label: "Jane - Frustrated" },
			{ id: "e7168caa-f7ed-4e1c-98a1-434251f4f2b0", label: "Jane - Jealousy" },
			{ id: "c7a8eb83-5247-4540-89f3-6650d349100d", label: "Jane - Sad" },
			{ id: "230ccacf-8800-4aa0-8ac2-8d004f1d9fb7", label: "Jane - Shameful" },
			{ id: "7d0a90a3-c211-4489-aaa0-61269299edc7", label: "Jane - Confused" },
			{ id: "a3e41ea8-020b-44c0-8d8b-f6cc03524e31", label: "Jane - Sarcasm" },
			{ id: "49d024dd-981b-4462-bb17-74d381eb8fd7", label: "Marie - Happy" },
			{ id: "e0580ce5-e63c-4cbe-88c8-a983b80c5f1f", label: "Marie - Curious" },
			{ id: "2f62b1af-aea3-4079-9d10-7ca665ee7243", label: "Marie - Excited" },
			{ id: "4adeb2c6-25a3-44bc-8100-5234dfc1193b", label: "Marie - Sad" },
			{ id: "a7c07cdc-1c35-4d87-a938-c610a654f600", label: "Marie - Angry" },
		],
	},
] as const;

export type SpeechProviderId = (typeof speechProviderOptions)[number]["id"];
export type ResolvedSpeechSettings = {
	speech_provider: SpeechProviderId;
	speech_model: string;
};

const defaultSpeechProvider = speechProviderOptions[0];

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

export function getSpeechProviderOption(provider?: string | null) {
	return speechProviderOptions.find((option) => option.id === provider) ?? defaultSpeechProvider;
}

export function getSpeechModelOptions(provider?: string | null) {
	return getSpeechProviderOption(provider).models;
}

export function resolveSpeechSettings(
	provider?: string | null,
	model?: string | null,
): ResolvedSpeechSettings {
	const providerOption = getSpeechProviderOption(provider);
	const matchingModel = providerOption.models.find((option) => option.id === model);

	return {
		speech_provider: providerOption.id,
		speech_model: matchingModel?.id ?? providerOption.models[0].id,
	};
}
