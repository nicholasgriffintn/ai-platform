import { ConnectorLogo } from "@ngriffin_uk/polychat-component-account";
import {
  CapabilityDiscoveryList,
  RecipeConfigurationDialog,
} from "@ngriffin_uk/polychat-component-capabilities";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useRecipeConnectors,
  useConnectorSetup,
  useAssistantRecipes,
  useRecipeInstallations,
} from "@ngriffin_uk/polychat-library-react";
import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  capabilityDiscoveryResultSchema,
  type AssistantRecipe,
  type CapabilityDiscoveryItem,
  type RecipeConnectorManifest,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { Plug } from "lucide-react";

import { ConnectorSetupDialogs } from "../Connectors/ConnectorSetupDialogs.js";
import { findOwnInstallation } from "../Recipes/installations.js";
import { useRecipeWorkflows } from "../Recipes/useRecipeWorkflows.js";

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

function ConnectButton({
  connector,
  label,
  connecting,
  onConnect,
}: {
  connector: RecipeConnectorManifest;
  label: string;
  connecting: boolean;
  onConnect: (connector: RecipeConnectorManifest) => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      aria-label={`Connect ${connector.name}`}
      disabled={connecting}
      onClick={() => onConnect(connector)}
    >
      <Plug className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
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

      if (!connector) {
        return null;
      }

      if (connector.status === "connected") {
        return <span className="text-xs text-muted-foreground">Connected</span>;
      }

      return (
        <ConnectButton
          connector={connector}
          label="Connect"
          connecting={connectorSetup.connectingProviderId === connector.id}
          onConnect={(target) => void connectorSetup.connect(target)}
        />
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
        <ConnectButton
          key={connector.id}
          connector={connector}
          label={`Connect ${connector.name}`}
          connecting={connectorSetup.connectingProviderId === connector.id}
          onConnect={(target) => void connectorSetup.connect(target)}
        />
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

  const setupItems = parsed.data.items.filter((item) => item.state === "setup_required");
  const itemById = new Map(setupItems.map((item) => [item.id, item] as const));
  const renderIcon = (item: CapabilityDiscoveryItem) => {
    const connector =
      item.setup?.kind === "connector" ? connectorById.get(item.setup.provider) : undefined;

    return connector ? (
      <ConnectorLogo connector={connector} className="size-8 rounded-lg [&_img]:size-5" />
    ) : undefined;
  };

  if (parsed.data.readiness?.state === "unknown") {
    return (
      <div className="space-y-1 rounded-md border border-border-strong bg-surface-elevated p-3 text-sm text-foreground">
        <p className="font-medium">Couldn't check what's available</p>
        <p>Send your message again to retry.</p>
      </div>
    );
  }

  return (
    <section aria-label="Setup needed">
      <CapabilityDiscoveryList
        items={setupItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          icon: renderIcon(item),
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
    </section>
  );
}
