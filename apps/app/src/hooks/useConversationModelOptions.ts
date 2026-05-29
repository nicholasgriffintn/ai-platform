import { useCallback, useMemo } from "react";

import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import {
	doesModelMatchId,
	getAvailableModels,
	getFeaturedModels,
	getModelsByMode,
	modelHasOutputModality,
	searchModelList,
	sortModelsByDisplayName,
} from "~/lib/models";
import { useChatStore } from "~/state/stores/chatStore";
import type { ModelConfigItem, ModelModality } from "~/types";

interface UseConversationModelOptionsOptions {
	excludeCurrentModel?: boolean;
	excludedModelIds?: readonly (string | null | undefined)[];
	requiredOutputModality?: ModelModality;
}

const EMPTY_EXCLUDED_MODEL_IDS: readonly (string | null | undefined)[] = [];

export function useConversationModelOptions({
	excludeCurrentModel = false,
	excludedModelIds = EMPTY_EXCLUDED_MODEL_IDS,
	requiredOutputModality,
}: UseConversationModelOptionsOptions = {}) {
	const chatMode = useChatStore((state) => state.chatMode);
	const currentModelId = useChatStore((state) => state.model);
	const { data: apiModels = {}, isLoading } = useModels();
	const webLLMModels = useWebLLMModels();

	const availableModels = useMemo(
		() => getAvailableModels(apiModels, chatMode === "local", webLLMModels),
		[apiModels, chatMode, webLLMModels],
	);
	const modeModels = useMemo(
		() => getModelsByMode(availableModels, chatMode),
		[availableModels, chatMode],
	);
	const currentModel = useMemo(
		() =>
			currentModelId
				? Object.values(modeModels).find((modelItem) =>
						doesModelMatchId(modelItem, currentModelId),
					) || null
				: null,
		[currentModelId, modeModels],
	);
	const normalizedExcludedModelIds = useMemo(
		() => [
			...excludedModelIds.filter((modelId): modelId is string => Boolean(modelId)),
			...(excludeCurrentModel && currentModelId ? [currentModelId] : []),
		],
		[currentModelId, excludeCurrentModel, excludedModelIds],
	);
	const isModelExcluded = useCallback(
		(modelItem: ModelConfigItem) =>
			normalizedExcludedModelIds.some((modelId) => doesModelMatchId(modelItem, modelId)),
		[normalizedExcludedModelIds],
	);
	const isSelectableModel = useCallback(
		(modelItem: ModelConfigItem) => {
			if (modelItem.deprecated || isModelExcluded(modelItem)) {
				return false;
			}

			return requiredOutputModality
				? modelHasOutputModality(modelItem, requiredOutputModality)
				: true;
		},
		[isModelExcluded, requiredOutputModality],
	);
	const selectableModels = useMemo(
		() => sortModelsByDisplayName(Object.values(modeModels).filter(isSelectableModel)),
		[isSelectableModel, modeModels],
	);
	const featuredModels = useMemo(
		() => getFeaturedModels(modeModels).filter(isSelectableModel),
		[isSelectableModel, modeModels],
	);
	const featuredModelIds = useMemo(
		() => new Set(featuredModels.map((modelItem) => modelItem.id)),
		[featuredModels],
	);
	const searchableModels = useMemo(
		() => selectableModels.filter((modelItem) => !featuredModelIds.has(modelItem.id)),
		[featuredModelIds, selectableModels],
	);
	const searchModels = useCallback(
		(query: string) => searchModelList(searchableModels, query),
		[searchableModels],
	);

	return {
		currentModel,
		currentModelId,
		featuredModels,
		isLoading,
		searchableModels,
		searchModels,
		selectableModels,
	};
}
