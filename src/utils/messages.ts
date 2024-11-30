import type { Message } from '../types';

export function filterMessages(messageHistory: Message[]): Message[] {
	return messageHistory.filter((message) => message.content);
}

export function formatMessages(provider: string, systemPrompt: string, messageHistory: Message[]): Message[] {
	const cleanedMessageHistory = filterMessages(messageHistory);

	if (cleanedMessageHistory.length === 0) {
		return [];
	}

	if (provider === 'anthropic') {
		return cleanedMessageHistory.map((message) => ({
			role: message.role,
			content: message.content,
		}));
	}

	return [
		{
			role: 'system',
			content: systemPrompt,
		},
		...cleanedMessageHistory,
	];
}
