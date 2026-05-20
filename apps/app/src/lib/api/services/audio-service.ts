import { fetchApi, returnFetchedData } from "../fetch-wrapper";

export interface SpeechGenerationResponse {
	status: "success" | "error";
	content: string;
	data: {
		audioKey?: string;
		audioUrl?: string;
		audioBase64?: string;
		audioDataUrl?: string;
		audioMimeType?: string;
		provider?: string;
		response?: string;
		metadata?: Record<string, unknown>;
	};
}

export class AudioService {
	constructor(private getHeaders: () => Promise<Record<string, string>>) {}

	async generateSpeech(
		input: string,
		options?: { store?: boolean },
	): Promise<SpeechGenerationResponse> {
		let headers = {};
		try {
			headers = await this.getHeaders();
		} catch (error) {
			console.error("Error generating speech:", error);
		}

		const response = await fetchApi("/audio/speech", {
			method: "POST",
			headers,
			body: {
				input,
				store: options?.store ?? true,
			},
			timeoutMs: null,
		});

		if (!response.ok) {
			throw new Error(`Failed to generate speech: ${response.statusText}`);
		}

		const data = await returnFetchedData<{ response: SpeechGenerationResponse }>(response);
		return data.response;
	}
}
