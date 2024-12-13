import type { AIResponseParams } from "../types";
import { fetchAIResponse } from "./fetch";
import { trackProviderMetrics } from "../lib/monitoring";

export interface AIProvider {
	name: string;
	getResponse(params: AIResponseParams): Promise<any>;
}

export async function getAIResponseFromProvider(
	provider: string,
	url: string,
	headers: Record<string, string>,
	body: Record<string, unknown>,
	analyticsEngine?: any,
) {
	return trackProviderMetrics(
		provider,
		body.model as string,
		async () => {
			const data: any = await fetchAIResponse(provider, url, headers, body);

			if (provider === "google-ai-studio") {
				const response = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
				return { ...data, response };
			}

			const message = data.choices?.[0]?.message;
			return { ...data, response: message?.content || "", ...message };
		},
		analyticsEngine,
	);
}
