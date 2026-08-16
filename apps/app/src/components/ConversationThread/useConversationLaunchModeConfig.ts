import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";

import { mergeChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/request-options";
import {
	loadAssistantActionRequestOptions,
	parseAssistantActionLaunchState,
	createRecipeAssistantActionLaunch,
	readRecipeConversationLaunchIntent,
	removeConsumedAssistantActionLaunchParams,
} from "~/lib/assistant-action-launch";
import { useInstallAssistantRecipe, useInvokeAssistantRecipe } from "~/hooks/useRecipes";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import type { ChatRequestOptions } from "~/types";
import type { ConversationThreadModeConfig } from ".";

interface ResolvedConversationLaunch {
	autoSubmit?: { input: string; key: string };
	requestOptions?: ChatRequestOptions;
}

export function useConversationLaunchModeConfig(
	modeConfig?: ConversationThreadModeConfig,
): ConversationThreadModeConfig | undefined {
	const location = useLocation();
	const { clearCurrentConversation, initializeStore, setChatInput, startNewConversation } =
		useChatStore();
	const { setSelectedTools } = useToolsStore();
	const installRecipe = useInstallAssistantRecipe();
	const invokeRecipe = useInvokeAssistantRecipe();
	const [launch, setLaunch] = useState<ResolvedConversationLaunch>();
	const initialiseSequenceRef = useRef(0);

	useEffect(() => {
		const locationKey = `${location.key}:${location.pathname}${location.search}`;
		const sequence = ++initialiseSequenceRef.current;
		const initialise = async () => {
			const params = new URLSearchParams(location.search);
			const completionId = params.get("completion_id");
			const urlLaunch = parseAssistantActionLaunchState(location.search);
			const recipeIntent = readRecipeConversationLaunchIntent(location.search);

			if (!completionId) clearCurrentConversation();
			await initializeStore(completionId || undefined);
			if (initialiseSequenceRef.current !== sequence) return;

			let recipeLaunch: ReturnType<typeof createRecipeAssistantActionLaunch> | undefined;
			if (recipeIntent) {
				try {
					const projectId = modeConfig?.requestOptions?.metadata?.project_id;
					const response =
						recipeIntent.action === "setup"
							? await installRecipe.mutateAsync({ recipeId: recipeIntent.recipeId, projectId })
							: await invokeRecipe.mutateAsync({ recipeId: recipeIntent.recipeId, projectId });
					if (initialiseSequenceRef.current !== sequence) return;
					recipeLaunch = createRecipeAssistantActionLaunch(response);
				} catch (error) {
					if (initialiseSequenceRef.current !== sequence) return;
					console.error(error);
					toast.error("Could not start recipe chat. Please try again.");
					return;
				}
			}

			const autoSubmitInput =
				recipeLaunch?.input ?? (urlLaunch.autoSubmit ? (urlLaunch.query ?? undefined) : undefined);

			if (autoSubmitInput) {
				startNewConversation();
				setChatInput("");
			} else if (urlLaunch.query) {
				setChatInput(urlLaunch.query);
			}

			if (recipeLaunch || urlLaunch.hasEnabledTools) {
				setSelectedTools(recipeLaunch?.enabledTools ?? urlLaunch.enabledTools);
			}

			setLaunch({
				...(autoSubmitInput ? { autoSubmit: { input: autoSubmitInput, key: locationKey } } : {}),
				requestOptions:
					recipeLaunch?.requestOptions ?? loadAssistantActionRequestOptions(urlLaunch),
			});

			if (recipeLaunch || urlLaunch.autoSubmit) {
				const query = removeConsumedAssistantActionLaunchParams(location.search);
				const historyState =
					window.history.state && typeof window.history.state === "object"
						? { ...window.history.state, usr: null }
						: {};
				window.history.replaceState(
					historyState,
					"",
					`${window.location.pathname}${query ? `?${query}` : ""}`,
				);
			}
		};

		void initialise();
		return () => {
			if (initialiseSequenceRef.current === sequence) initialiseSequenceRef.current += 1;
		};
	}, [
		clearCurrentConversation,
		initializeStore,
		installRecipe.mutateAsync,
		location.key,
		location.pathname,
		location.search,
		modeConfig?.requestOptions?.metadata?.project_id,
		setChatInput,
		setSelectedTools,
		startNewConversation,
		invokeRecipe.mutateAsync,
	]);

	return useMemo(() => {
		if (!launch?.autoSubmit && !launch?.requestOptions) return modeConfig;

		return {
			...modeConfig,
			initialAutoSubmit: launch.autoSubmit ?? modeConfig?.initialAutoSubmit,
			requestOptions: mergeChatRequestOptions(modeConfig?.requestOptions, launch.requestOptions),
		};
	}, [launch, modeConfig]);
}
