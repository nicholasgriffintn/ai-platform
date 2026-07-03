import {
	normaliseCompactionStatusMessage,
	type NormalisedCompactionStatusMessage,
} from "@assistant/schemas";

export interface ChatCompactionMetadata {
	message: NormalisedCompactionStatusMessage;
}

export function buildChatCompactionMetadata(message: unknown): ChatCompactionMetadata | undefined {
	const compactionMessage = normaliseCompactionStatusMessage(message);

	if (!compactionMessage) {
		return undefined;
	}
	return {
		message: compactionMessage,
	};
}
