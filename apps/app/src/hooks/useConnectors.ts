import { useMutation, useQuery } from "@tanstack/react-query";

import {
	disconnectRecipeConnector,
	listRecipeConnectors,
	startRecipeConnector,
} from "~/lib/api/connectors";

export const RECIPE_CONNECTORS_QUERY_KEY = ["recipe-connectors"] as const;

export function useRecipeConnectors() {
	return useQuery({
		queryKey: RECIPE_CONNECTORS_QUERY_KEY,
		queryFn: listRecipeConnectors,
		staleTime: 60 * 1000,
	});
}

export function useStartRecipeConnector() {
	return useMutation({
		mutationFn: ({
			provider,
			returnTo,
		}: {
			provider: Parameters<typeof startRecipeConnector>[0];
			returnTo?: string;
		}) => startRecipeConnector(provider, returnTo),
	});
}

export function useDisconnectRecipeConnector() {
	return useMutation({
		mutationFn: disconnectRecipeConnector,
	});
}
