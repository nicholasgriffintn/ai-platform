import type { IRequest, IFunctionResponse } from '../types';
import { ChatHistory } from '../lib/history';
import { chatSystemPrompt } from '../lib/prompts';
import { getMatchingModel } from '../lib/models';
import { handleFunctions } from './functions';
import { getWorkersAIResponse } from '../lib/chat';

export const handleCreateChat = async (req: IRequest): Promise<IFunctionResponse | IFunctionResponse[]> => {
	const { request, env, user } = req;

	if (!request) {
		return {
			status: 'error',
			content: 'Missing request',
		};
	}

	if (!request.chat_id || !request.input) {
		return {
			status: 'error',
			content: 'Missing chat_id or input',
		};
	}

	if (!env.CHAT_HISTORY) {
		return {
			status: 'error',
			content: 'Missing chat history',
		};
	}

	const platform = request.platform || 'api';

	const model = getMatchingModel(request.model);

	if (!model) {
		return {
			status: 'error',
			content: 'No matching model found',
		};
	}

	const chatHistory = ChatHistory.getInstance(env.CHAT_HISTORY, model, platform);
	await chatHistory.add(request.chat_id, {
		role: 'user',
		content: request.input,
	});

	const systemPrompt = chatSystemPrompt(request, user);

	const messageHistory = await chatHistory.get(request.chat_id);
	const cleanedMessageHistory = messageHistory.filter((message) => message.content);

	if (cleanedMessageHistory.length < 0) {
		return {
			status: 'error',
			content: 'No messages found',
		};
	}

	const messages = [
		{
			role: 'system',
			content: systemPrompt,
		},
		...cleanedMessageHistory,
	];

	const modelResponse = await getWorkersAIResponse({
		model,
		messages,
		env,
	});
	const modelResponseLogId = env.AI.aiGatewayLogId;

	if (modelResponse.tool_calls) {
		const functionResults = [];

		const toolMessage = await chatHistory.add(request.chat_id, {
			role: 'assistant',
			name: 'External Functions',
			tool_calls: modelResponse.tool_calls,
			logId: modelResponseLogId,
			content: '',
		});

		functionResults.push(toolMessage);

		for (const toolCall of modelResponse.tool_calls) {
			try {
				const result = await handleFunctions(toolCall.name, toolCall.arguments, req);

				const message = await chatHistory.add(request.chat_id, {
					role: 'assistant',
					name: toolCall.name,
					content: result.content,
					status: result.status,
					data: result.data,
					logId: modelResponseLogId,
				});
				functionResults.push(message);
			} catch (e) {
				console.error(e);
				functionResults.push({
					role: 'assistant',
					name: toolCall.name,
					content: 'Error',
					status: 'error',
					logId: modelResponseLogId,
				});
			}
		}

		return functionResults;
	}

	if (!modelResponse.response) {
		return {
			status: 'error',
			content: 'No response from the model',
		};
	}

	const message = await chatHistory.add(request.chat_id, {
		role: 'assistant',
		content: modelResponse.response,
		logId: modelResponseLogId,
	});

	return [message];
};
