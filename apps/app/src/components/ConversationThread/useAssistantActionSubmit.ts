import { toast } from "sonner";
import type { AssistantActionResult } from "@assistant/schemas";

import { useStartRecipeConnector } from "~/hooks/useConnectors";
import { useInstallAssistantRecipe, useInvokeAssistantRecipe } from "~/hooks/useRecipes";
import { launchAssistantAction } from "~/lib/assistant-action-flow";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";

export function useAssistantActionSubmit() {
	const selectedAssistantAction = useChatStore((state) => state.selectedAssistantAction);
	const setSelectedAssistantAction = useChatStore((state) => state.setSelectedAssistantAction);
	const selectedTools = useToolsStore((state) => state.selectedTools);
	const setSelectedTools = useToolsStore((state) => state.setSelectedTools);
	const startConnector = useStartRecipeConnector();
	const installRecipe = useInstallAssistantRecipe();
	const invokeRecipe = useInvokeAssistantRecipe();

	const resolveAssistantActionSubmit = async (input: string): Promise<AssistantActionResult> => {
		const item = selectedAssistantAction?.item;
		if (!item) {
			return { kind: "submit", input };
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

		return result;
	};

	return {
		resolveAssistantActionSubmit,
	};
}
