import { toast } from "sonner";

import { useStartRecipeConnector } from "~/hooks/useConnectors";
import { useInstallAssistantRecipe, useInvokeAssistantRecipe } from "~/hooks/useRecipes";
import { launchAssistantAction } from "~/lib/assistant-action-flow";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import type { ChatRequestOptions } from "~/types";

interface AssistantActionSubmitResult {
	externalUrl?: string;
	input: string;
	navigationPath?: string;
	requestOptions?: ChatRequestOptions;
}

export function useAssistantActionSubmit() {
	const selectedAssistantAction = useChatStore((state) => state.selectedAssistantAction);
	const setSelectedAssistantAction = useChatStore((state) => state.setSelectedAssistantAction);
	const selectedTools = useToolsStore((state) => state.selectedTools);
	const setSelectedTools = useToolsStore((state) => state.setSelectedTools);
	const startConnector = useStartRecipeConnector();
	const installRecipe = useInstallAssistantRecipe();
	const invokeRecipe = useInvokeAssistantRecipe();

	const resolveAssistantActionSubmit = async (
		input: string,
	): Promise<AssistantActionSubmitResult> => {
		const item = selectedAssistantAction?.item;
		if (!item) {
			return { input };
		}

		const verb = selectedAssistantAction?.verb;
		const result = await launchAssistantAction(
			{
				delivery: "submit",
				input,
				item,
				selectedTools,
				...(verb ? { verb: { command: verb, id: verb } } : {}),
			},
			{
				installRecipe: (recipeId) => installRecipe.mutateAsync({ recipeId }),
				invokeRecipe: (recipeId, recipeInput) =>
					invokeRecipe.mutateAsync({ recipeId, input: recipeInput }),
				startConnector: (provider, returnTo) => startConnector.mutateAsync({ provider, returnTo }),
			},
		);

		if (result.notification?.type === "error") {
			toast.error(result.notification.message);
		}
		if (result.selectedTools) {
			setSelectedTools(result.selectedTools);
		}
		setSelectedAssistantAction(null);

		if (result.kind === "external") {
			return {
				externalUrl: result.url,
				input: result.input,
			};
		}
		if (result.kind === "navigation") {
			return {
				input: result.input,
				navigationPath: result.path,
			};
		}

		return {
			input: result.input,
			...(result.kind === "conversation" || result.kind === "submit"
				? result.requestOptions
					? { requestOptions: result.requestOptions }
					: {}
				: {}),
		};
	};

	return {
		resolveAssistantActionSubmit,
	};
}
