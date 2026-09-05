import {
  CapabilityDiscoveryList,
  RecipeConfigurationDialog,
} from "@ngriffin_uk/polychat-component-capabilities";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  capabilityDiscoveryResultSchema,
  type AssistantRecipe,
  type CapabilityDiscoveryItem,
  type RecipeConnectorManifest,
  type RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { Plug } from "lucide-react";

import { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import { ConnectorSetupDialogs } from "~/components/Connectors/ConnectorSetupDialogs";
import { useRecipeConnectors } from "~/hooks/useConnectors";
import { useConnectorSetup } from "~/hooks/useConnectorSetup";
import { useAssistantRecipes, useRecipeInstallations } from "~/hooks/useRecipes";
import { useChatStore } from "~/state/stores/chatStore";

function getMissingConnectors(
  recipe: AssistantRecipe,
  connectors: readonly RecipeConnectorManifest[],
): RecipeConnectorManifest[] {
  const connectorById = new Map(connectors.map((connector) => [connector.id, connector]));

  return recipe.integrations.flatMap((integration) => {
    if (!integration.requiresConnection || integration.connectionStatus === "connected") {
      return [];
    }

    const connector = connectorById.get(integration.providerId);

    return connector && connector.status !== "connected" ? [connector] : [];
  });
}

function findOwnInstallation(
  installations: readonly RecipeInstallation[],
  recipeId: string,
  userId?: number,
) {
  return installations.find(
    (installation) =>
      installation.recipeId === recipeId &&
      (userId === undefined || installation.userId === userId),
  );
}

function stateLabel(item: CapabilityDiscoveryItem) {
  switch (item.state) {
    case "ready":
      return "Ready";
    case "setup_required":
      return "Setup required";
    case "unavailable":
      return "Unavailable";
    case "unknown":
      return "Unknown";
  }
}

export function CapabilityDiscoveryView({ data }: { data: unknown }) {
  const payload = isRecord(data) ? data[CAPABILITY_DISCOVERY_DATA_KEY] : undefined;
  const parsed = capabilityDiscoveryResultSchema.safeParse(payload);
  const projectId = parsed.success ? parsed.data.projectId : undefined;
  const userId = useChatStore((state) => state.user?.id);
  const recipesQuery = useAssistantRecipes();
  const installationsQuery = useRecipeInstallations(projectId);
  const connectorsQuery = useRecipeConnectors();
  const workflows = useRecipeWorkflows({ projectId });
  const connectorSetup = useConnectorSetup();

  if (!parsed.success) {
    return <p className="text-sm text-failure">Discovery results are invalid.</p>;
  }

  const recipes = recipesQuery.data?.recipes ?? [];
  const installations = installationsQuery.data?.installations ?? [];
  const connectors = connectorsQuery.data?.connectors ?? [];
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const connectorById = new Map(connectors.map((connector) => [connector.id, connector]));

  const renderSetup = (item: CapabilityDiscoveryItem) => {
    if (item.setup?.kind === "connector") {
      const connector = connectorById.get(item.setup.provider);

      if (!connector || connector.status === "connected") {
        return null;
      }

      return (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={connectorSetup.connectingProviderId === connector.id}
          onClick={() => void connectorSetup.connect(connector)}
        >
          <Plug className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Connect {connector.name}
        </Button>
      );
    }

    if (item.setup?.kind !== "recipe") {
      return null;
    }

    const recipe = recipeById.get(item.setup.recipeId);

    if (!recipe) {
      return null;
    }

    const installation = findOwnInstallation(installations, recipe.id, userId);
    const missingConnectors = getMissingConnectors(recipe, connectors);
    const hasBlockingConnection = recipe.integrations.some(
      (integration) =>
        integration.requiresConnection && integration.connectionStatus !== "connected",
    );

    if (missingConnectors.length > 0) {
      return missingConnectors.map((connector) => (
        <Button
          key={connector.id}
          type="button"
          size="sm"
          variant="secondary"
          disabled={connectorSetup.connectingProviderId === connector.id}
          onClick={() => void connectorSetup.connect(connector)}
        >
          <Plug className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Connect {connector.name}
        </Button>
      ));
    }

    if (hasBlockingConnection) {
      return null;
    }

    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => {
          if (installation?.status === "paused") {
            void workflows.actions.toggleInstallationStatus(installation);

            return;
          }

          workflows.actions.openConfigurationDialog(recipe, installation);
        }}
      >
        {installation?.status === "paused" ? "Resume recipe" : "Configure recipe"}
      </Button>
    );
  };

  const itemById = new Map(parsed.data.items.map((item) => [item.id, item] as const));

  return (
    <div className="space-y-3" role="region" aria-label="Capability discovery results">
      <CapabilityDiscoveryList
        items={parsed.data.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          reason: item.reason,
          state: item.state,
          stateLabel: stateLabel(item),
        }))}
        renderSetupActions={(item) => {
          const original = itemById.get(item.id);

          return original ? renderSetup(original) : null;
        }}
      />
      <ConnectorSetupDialogs controller={connectorSetup} />
      <RecipeConfigurationDialog
        recipe={workflows.configurationDialog.recipe}
        installation={workflows.configurationDialog.installation}
        values={workflows.configurationDialog.values}
        onValuesChange={workflows.configurationDialog.setValues}
        onClose={workflows.configurationDialog.close}
        onSubmit={workflows.configurationDialog.submit}
        isLoading={workflows.configurationDialog.isLoading}
      />
    </div>
  );
}
