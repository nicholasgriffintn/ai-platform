import { useEffect, useState } from "react";

import { getCachedWebLLMModels, loadWebLLMModels } from "~/lib/web-llm-models";
import type { ModelConfig } from "~/types";

export function useWebLLMModels() {
	const [models, setModels] = useState<ModelConfig>(() => getCachedWebLLMModels());

	useEffect(() => {
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
	}, []);

	return models;
}
