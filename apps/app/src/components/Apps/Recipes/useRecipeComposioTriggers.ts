import type {
	RecipeComposioTriggerCreateRequest,
	RecipeConnectorProvider,
} from "@assistant/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createRecipeComposioTrigger,
	deleteRecipeComposioTrigger,
	listRecipeComposioTriggers,
	listRecipeComposioTriggerTypes,
	updateRecipeComposioTrigger,
} from "~/lib/api/recipe-composio-triggers";

export const recipeComposioTriggersQueryKey = (installationId: string) =>
	["recipe-composio-triggers", installationId] as const;

const recipeComposioTriggerTypesQueryKey = (
	installationId: string,
	providerId: RecipeConnectorProvider,
) => [...recipeComposioTriggersQueryKey(installationId), providerId, "types"] as const;

export function useRecipeComposioTriggers(
	installationId: string,
	providerId: RecipeConnectorProvider,
) {
	const queryClient = useQueryClient();
	const triggers = useQuery({
		queryKey: recipeComposioTriggersQueryKey(installationId),
		queryFn: () => listRecipeComposioTriggers(installationId),
	});
	const triggerTypes = useQuery({
		queryKey: recipeComposioTriggerTypesQueryKey(installationId, providerId),
		queryFn: () => listRecipeComposioTriggerTypes(installationId, providerId),
	});
	const refreshTriggers = () =>
		queryClient.invalidateQueries({ queryKey: recipeComposioTriggersQueryKey(installationId) });
	const createTrigger = useMutation({
		mutationFn: (input: RecipeComposioTriggerCreateRequest) =>
			createRecipeComposioTrigger(installationId, input),
		onSuccess: refreshTriggers,
	});
	const updateTrigger = useMutation({
		mutationFn: ({ triggerId, status }: { triggerId: string; status: "active" | "paused" }) =>
			updateRecipeComposioTrigger(triggerId, status),
		onSuccess: refreshTriggers,
	});
	const deleteTrigger = useMutation({
		mutationFn: deleteRecipeComposioTrigger,
		onSuccess: refreshTriggers,
	});

	return { triggers, triggerTypes, createTrigger, updateTrigger, deleteTrigger };
}
