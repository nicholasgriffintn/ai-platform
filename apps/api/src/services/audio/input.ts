import type { SpeechProvider } from "./speech";

const defaultSpeechInputLimit = {
	maxCharacters: 4096,
};

const speechInputLimitsByProvider: Partial<
	Record<
		SpeechProvider,
		{
			maxCharacters?: number;
			maxWords?: number;
		}
	>
> = {
	mistral: {
		maxCharacters: 4096,
		maxWords: 300,
	},
};

export type PreparedSpeechInput = {
	input: string;
	metadata?: {
		inputTruncated: true;
		originalInputLength: number;
		truncatedInputLength: number;
		maxCharacters?: number;
		maxWords?: number;
	};
};

export function prepareSpeechInput(input: string, provider: SpeechProvider): PreparedSpeechInput {
	const limit = {
		...defaultSpeechInputLimit,
		...speechInputLimitsByProvider[provider],
	};
	const originalInputLength = input.length;
	let truncatedInput = input;

	if (limit.maxWords) {
		truncatedInput = truncateToWords(truncatedInput, limit.maxWords);
	}

	if (limit.maxCharacters && truncatedInput.length > limit.maxCharacters) {
		truncatedInput = truncatedInput.slice(0, limit.maxCharacters).trimEnd();
	}

	if (truncatedInput === input) {
		return { input };
	}

	return {
		input: truncatedInput,
		metadata: {
			inputTruncated: true,
			originalInputLength,
			truncatedInputLength: truncatedInput.length,
			maxCharacters: limit.maxCharacters,
			maxWords: limit.maxWords,
		},
	};
}

function truncateToWords(input: string, maxWords: number): string {
	const matches = input.match(/\S+\s*/g);
	if (!matches || matches.length <= maxWords) {
		return input;
	}

	return matches.slice(0, maxWords).join("").trimEnd();
}
