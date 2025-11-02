import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { webLLMModels } from "~/lib/models";
import { WebLLMService } from "~/lib/web-llm";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";

/**
 * Hook for initializing WebLLM local models.
 * Handles model loading, progress tracking, and error states.
 */
export function useWebLLMInitialization(apiModels: Record<string, any> = {}) {
	const { startLoading, updateLoading, stopLoading } = useLoadingActions();
	const { chatMode, model, setModel } = useChatStore();

	const webLLMService = useRef<WebLLMService>(WebLLMService.getInstance());
	const initializingRef = useRef<boolean>(false);

	const matchingModel =
		model === null
			? undefined
			: chatMode === "local"
				? webLLMModels[model]
				: apiModels[model];

	useEffect(() => {
		const loadingId = "model-init";
		let mounted = true;

		const initializeLocalModel = async () => {
			if (!mounted || initializingRef.current) return;

			if (
				model &&
				chatMode === "local" &&
				matchingModel?.provider === "web-llm"
			) {
				try {
					initializingRef.current = true;

					startLoading(
						loadingId,
						`Initializing ${matchingModel.name || model}...`,
					);

					updateLoading(
						loadingId,
						0,
						`Preparing to load ${matchingModel.name || model}...`,
					);

					await webLLMService.current.init(model, (progress) => {
						if (!mounted) return;

						const progressPercent = Math.round(progress.progress * 100);

						updateLoading(
							loadingId,
							Math.max(1, progressPercent),
							progress.text || `Loading ${matchingModel.name || model}...`,
						);
					});
				} catch (error) {
					console.error(
						"[useWebLLMInitialization] Failed to initialize WebLLM:",
						error,
					);
					if (mounted) {
						toast.error("Failed to initialize local model. Please try again.");
						setModel(null);
					}
				} finally {
					if (mounted) {
						stopLoading(loadingId);
						initializingRef.current = false;
					}
				}
			} else if (initializingRef.current) {
				stopLoading(loadingId);
				initializingRef.current = false;
			}
		};

		const timer = setTimeout(() => {
			initializeLocalModel();
		}, 100);

		return () => {
			mounted = false;
			clearTimeout(timer);
			if (initializingRef.current) {
				stopLoading(loadingId);
				initializingRef.current = false;
			}
		};
	}, [
		chatMode,
		model,
		matchingModel,
		startLoading,
		updateLoading,
		stopLoading,
		setModel,
	]);

	return {
		webLLMService: webLLMService.current,
		isInitializing: initializingRef.current,
	};
}
