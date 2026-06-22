import { useMutation, useQuery } from "@tanstack/react-query";

import {
	disconnectRecipeConnector,
	listRecipeConnectors,
	startRecipeConnector,
	storeRecipeConnectorApiKey,
} from "~/lib/api/connectors";
import { useCanAccessProFeatures } from "./useCanAccessProFeatures";

export const RECIPE_CONNECTORS_QUERY_KEY = ["recipe-connectors"] as const;

export function useRecipeConnectors() {
	const canAccessProFeatures = useCanAccessProFeatures();
	const query = useQuery({
		queryKey: RECIPE_CONNECTORS_QUERY_KEY,
		queryFn: listRecipeConnectors,
		enabled: canAccessProFeatures,
		staleTime: 60 * 1000,
	});
	return {
		...query,
		data: canAccessProFeatures ? query.data : undefined,
		error: canAccessProFeatures ? query.error : null,
		isFetching: canAccessProFeatures ? query.isFetching : false,
		isLoading: canAccessProFeatures ? query.isLoading : false,
	};
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

export function useStoreRecipeConnectorApiKey() {
	return useMutation({
		mutationFn: ({
			provider,
			apiKey,
		}: {
			provider: Parameters<typeof storeRecipeConnectorApiKey>[0];
			apiKey: string;
		}) => storeRecipeConnectorApiKey(provider, { apiKey }),
	});
}
