import {
	normaliseCompactionStatusMessage,
	type NormalisedCompactionStatusMessage,
} from "@ngriffin_uk/polychat-schemas";

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
