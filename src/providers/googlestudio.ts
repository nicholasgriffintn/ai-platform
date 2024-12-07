import { AIProvider, getAIResponseFromProvider } from './base';
import { getGatewayExternalProviderUrl } from '../lib/chat';
import type { AIResponseParams } from '../types';
import { AppError } from '../utils/errors';

export class GoogleStudioProvider implements AIProvider {
	name = 'google-ai-studio';

	async getResponse({ model, messages, env, user, systemPrompt, temperature, max_tokens, top_p }: AIResponseParams) {
		if (!env.GOOGLE_STUDIO_API_KEY || !env.AI_GATEWAY_TOKEN) {
			throw new AppError('Missing GOOGLE_STUDIO_API_KEY or AI_GATEWAY_TOKEN', 400);
		}

		const isBeta = model?.includes('gemini-exp');

		const url = `${getGatewayExternalProviderUrl(env, 'google-ai-studio')}/${isBeta ? 'v1beta' : 'v1'}/models/${model}:generateContent`;
		const headers = {
			'cf-aig-authorization': env.AI_GATEWAY_TOKEN,
			'x-goog-api-key': env.GOOGLE_STUDIO_API_KEY,
			'Content-Type': 'application/json',
			'cf-aig-metadata': JSON.stringify({ email: user?.email }),
		};

		const body = {
			contents: messages,
			systemInstruction: {
				role: 'system',
				parts: [
					{
						text: systemPrompt,
					},
				],
			},
			generationConfig: {
				temperature,
				maxOutputTokens: max_tokens,
				topP: top_p,
			},
		};

		return getAIResponseFromProvider('google-ai-studio', url, headers, body);
	}
}
