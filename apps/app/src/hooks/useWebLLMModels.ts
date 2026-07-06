import { useEffect, useState } from "react";

import { getCachedWebLLMModels, loadWebLLMModels } from "~/lib/web-llm-models";
import type { ModelConfig } from "@assistant/schemas";

interface UseWebLLMModelsOptions {
	enabled?: boolean;
}

export function useWebLLMModels({ enabled = true }: UseWebLLMModelsOptions = {}) {
	const [models, setModels] = useState<ModelConfig>(() => getCachedWebLLMModels());

	useEffect(() => {
		if (!enabled) {
			return;
		}

		let mounted = true;

		loadWebLLMModels()
			.then((loadedModels) => {
				if (mounted) {
					setModels(loadedModels);
				}
			})
			.catch((error: unknown) => {
				console.error("[useWebLLMModels] Failed to load WebLLM models:", error);
			});

		return () => {
			mounted = false;
		};
	}, [enabled]);

	return models;
}
