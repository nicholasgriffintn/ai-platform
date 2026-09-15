import {
  completeConnectorAuthPopup,
  RECIPE_CONNECTORS_QUERY_KEY,
  useConnectorSetup,
  useDisconnectRecipeConnector,
  useRecipeConnectors,
} from "@ngriffin_uk/polychat-library-react";
import {
  createConnectorAssistantActionItem,
  recipeConnectorProviderSchema,
  type AssistantActionItem,
  type RecipeConnectorManifest,
} from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

export function usePluginsController() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConnector, setSelectedConnector] = useState<RecipeConnectorManifest | null>(null);
  const [connectorToDisconnect, setConnectorToDisconnect] =
    useState<RecipeConnectorManifest | null>(null);

  const connectorsQuery = useRecipeConnectors();
  const connectorSetup = useConnectorSetup();
  const disconnectConnector = useDisconnectRecipeConnector();
  const connectors = useMemo(
    () => connectorsQuery.data?.connectors ?? [],
    [connectorsQuery.data?.connectors],
  );
  const manifestsById = useMemo(
    () => new Map(connectors.map((connector) => [connector.id, connector])),
    [connectors],
  );
  const items = useMemo<AssistantActionItem[]>(
    () => connectors.map((connector) => createConnectorAssistantActionItem(connector)),
    [connectors],
  );

  useEffect(() => {
    completeConnectorAuthPopup(searchParams);
  }, [searchParams]);

  const requestedConnectorId = searchParams.get("connector");
  const requestedConnector =
    !requestedConnectorId || connectorsQuery.isLoading
      ? undefined
      : connectors.find((connector) => connector.id === requestedConnectorId);

  if (requestedConnector && selectedConnector?.id !== requestedConnector.id) {
    setSelectedConnector(requestedConnector);
  }

  useEffect(() => {
    if (!requestedConnector) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);

    nextSearchParams.delete("connector");
    nextSearchParams.delete("connected");
    setSearchParams(nextSearchParams, { replace: true });
  }, [requestedConnector, searchParams, setSearchParams]);

  const disconnect = async () => {
    if (!connectorToDisconnect) {
      return;
    }

    const provider = recipeConnectorProviderSchema.safeParse(connectorToDisconnect.id);

    if (!provider.success) {
      toast.error("Unknown connector provider.");
      setConnectorToDisconnect(null);

      return;
    }

    await disconnectConnector.mutateAsync(provider.data);
    await queryClient.invalidateQueries({ queryKey: RECIPE_CONNECTORS_QUERY_KEY });
    setConnectorToDisconnect(null);
  };

  return {
    connectorSetup,
    connectorToDisconnect,
    disconnect,
    isDisconnecting: disconnectConnector.isPending,
    isLoading: connectorsQuery.isLoading,
    items,
    manifestsById,
    selectedConnector,
    setConnectorToDisconnect,
    setSelectedConnector,
  };
}
