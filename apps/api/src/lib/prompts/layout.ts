export type PromptMetadataFormat = "full" | "compact";
export type PromptPrinciplesFormat = "full" | "compact";

interface PromptLayoutOptions {
	contextWindow?: number | null;
}

export interface PromptLayoutConfig {
	metadataFormat: PromptMetadataFormat;
	principlesFormat: PromptPrinciplesFormat;
}

const COMPACT_METADATA_THRESHOLD = 12000;
const COMPACT_PRINCIPLES_THRESHOLD = 9000;

export function resolvePromptLayout({ contextWindow }: PromptLayoutOptions): PromptLayoutConfig {
	const windowSize =
		typeof contextWindow === "number" && Number.isFinite(contextWindow)
			? contextWindow
			: Number.POSITIVE_INFINITY;

	const metadataFormat: PromptMetadataFormat =
		windowSize <= COMPACT_METADATA_THRESHOLD ? "compact" : "full";

	const principlesFormat: PromptPrinciplesFormat =
		windowSize <= COMPACT_PRINCIPLES_THRESHOLD ? "compact" : "full";

	return {
		metadataFormat,
		principlesFormat,
	};
}
