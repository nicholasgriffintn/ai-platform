import type { ChatSettings } from "~/types";

type RequestRagOptions = {
	include_metadata?: NonNullable<ChatSettings["rag_options"]>["includeMetadata"];
	namespace?: NonNullable<ChatSettings["rag_options"]>["namespace"];
	score_threshold?: NonNullable<ChatSettings["rag_options"]>["scoreThreshold"];
	top_k?: NonNullable<ChatSettings["rag_options"]>["topK"];
	type?: NonNullable<ChatSettings["rag_options"]>["type"];
};

type ChatCompactionMode = NonNullable<ChatSettings["compaction"]>;

type RequestGenerationSettings = Omit<
	ChatSettings,
	"compaction" | "enabled_tools" | "localOnly" | "rag_options" | "tool_options" | "use_rag"
> & {
	compaction?: ChatCompactionMode;
};

export interface ChatRequestSettingsProjection {
	enabledTools?: string[];
	generationSettings: RequestGenerationSettings;
	hostedToolOptions?: ChatSettings["tool_options"];
	ragOptions?: RequestRagOptions;
	useRag?: boolean;
}

function isChatCompactionMode(value: unknown): value is ChatCompactionMode {
	return value === "auto" || value === "off";
}

function hasDefinedValue(value: Record<string, unknown> | undefined): boolean {
	return Boolean(value && Object.values(value).some((item) => item !== undefined));
}

export function projectChatRequestSettings(
	chatSettings: ChatSettings,
): ChatRequestSettingsProjection {
	const {
		compaction,
		enabled_tools: enabledTools,
		localOnly: _localOnly,
		rag_options: ragOptions,
		tool_options: hostedToolOptions,
		use_rag: useRag,
		...generationSettings
	} = chatSettings;

	return {
		enabledTools,
		generationSettings: {
			...generationSettings,
			...(isChatCompactionMode(compaction) ? { compaction } : {}),
		},
		hostedToolOptions: hasDefinedValue(hostedToolOptions) ? hostedToolOptions : undefined,
		ragOptions: (() => {
			if (!ragOptions) {
				return undefined;
			}

			const requestRagOptions = {
				top_k: ragOptions.topK,
				score_threshold: ragOptions.scoreThreshold,
				include_metadata: ragOptions.includeMetadata,
				type: ragOptions.type,
				namespace: ragOptions.namespace,
			};

			return hasDefinedValue(requestRagOptions) ? requestRagOptions : undefined;
		})(),
		useRag,
	};
}
