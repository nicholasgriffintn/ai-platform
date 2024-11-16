import { AwsClient } from 'aws4fetch';

import type { IFunctionResponse, IEnv } from '../../../types';
import { ChatHistory } from '../../../lib/history';

export type UploadRequest = {
	env: IEnv;
	request: {
		audioUrl?: string;
	};
	user: { email: string };
};

interface IPodcastUploadResponse extends IFunctionResponse {
	chatId?: string;
}

export const handlePodcastUpload = async (req: UploadRequest): Promise<IPodcastUploadResponse> => {
	const { env, request } = req;

	if (!env.CHAT_HISTORY) {
		return {
			status: 'error',
			content: 'Missing chat history',
		};
	}

	const podcastId = Math.random().toString(36);

	const chatHistory = ChatHistory.getInstance(env.CHAT_HISTORY);
	await chatHistory.add(podcastId, {
		role: 'user',
		content: 'Generate a podcast record with a transcription',
		app: 'podcasts',
	});

	console.log('request', request);

	if (!request.audioUrl) {
		const imageKey = `podcasts/${podcastId}/recording.mp3`;
		const bucketName = 'assistant-assets';
		const accountId = env.ACCOUNT_ID;

		const url = new URL(`https://${bucketName}.${accountId}.r2.cloudflarestorage.com`);
		url.pathname = imageKey;
		url.searchParams.set('X-Amz-Expires', '3600');

		const r2 = new AwsClient({
			accessKeyId: env.ASSETS_BUCKET_ACCESS_KEY_ID,
			secretAccessKey: env.ASSETS_BUCKET_SECRET_ACCESS_KEY,
		});

		const signed = await r2.sign(
			new Request(url, {
				method: 'PUT',
			}),
			{
				aws: { signQuery: true },
			}
		);

		if (!signed) {
			return {
				status: 'error',
				content: 'Failed to sign request',
			};
		}

		const message = {
			role: 'assistant',
			content: `Podcast Uploaded: [Listen Here](https://assistant-assets.nickgriffin.uk/${imageKey})`,
			name: 'podcast_upload',
			data: {
				imageKey,
				url,
				signedUrl: signed.url,
			},
		};
		const response = await chatHistory.add(podcastId, message);

		return {
			...response,
			chatId: podcastId,
		};
	}

	const message = {
		role: 'assistant',
		content: 'Podcast Uploaded [Listen Here](' + request.audioUrl + ')',
		name: 'podcast_upload',
		data: {
			url: request.audioUrl,
		},
	};
	const response = await chatHistory.add(podcastId, message);

	return {
		...response,
		chatId: podcastId,
	};
};
