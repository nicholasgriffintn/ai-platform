import {
  ConnectorDetailsModal,
  ConnectorLogo,
  ProviderCatalogue,
  type ProviderCatalogueItem,
} from "@ngriffin_uk/polychat-component-account";
import { ConfirmationDialog, EmptyState, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import { Plug } from "lucide-react";

import { ConnectorAccountsPanel } from "../Connectors/ConnectorAccountsPanel.js";
import { ConnectorSetupDialogs } from "../Connectors/ConnectorSetupDialogs.js";
import { usePluginsController } from "./usePluginsController.js";

export function PluginsIntegrationsSection() {
  const controller = usePluginsController();
  const catalogueItems: ProviderCatalogueItem[] = controller.connectors.map((connector) => ({
    id: `connector:${connector.id}`,
    name: connector.name,
    description:
      controller.connectorSetup.connectingProviderId === connector.id
        ? "Waiting for connection in the popup…"
        : connector.description,
    category: connector.categories?.[0]?.name ?? "Integrations",
    connected: connector.status === "connected",
    connecting: controller.connectorSetup.connectingProviderId === connector.id,
    icon: <ConnectorLogo connector={connector} />,
    onSelect: () => controller.setSelectedConnector(connector),
  }));

  return (
    <section aria-labelledby="plugins-integrations-heading" className="mt-12">
      <h2 id="plugins-integrations-heading" className="mb-4 text-lg font-semibold text-foreground">
        Integrations
      </h2>
      {controller.hasConnectors && (
        <div className="mb-6">
          <SearchInput
            aria-label="Search integrations"
            placeholder="Search integrations"
            value={controller.search}
            onChange={controller.setSearch}
            className="w-full sm:max-w-xs"
          />
        </div>
      )}

      {controller.isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      ) : !controller.hasConnectors ? (
        <EmptyState
          icon={<Plug size={24} className="text-muted-foreground" />}
          title="No integrations available"
          message="Integrations you can connect will appear here."
          className="border-none bg-transparent px-0 py-10 dark:bg-transparent"
        />
      ) : catalogueItems.length === 0 ? (
        <EmptyState
          message="No integrations match your search"
          className="border-none bg-transparent px-0 py-10 dark:bg-transparent"
        />
      ) : (
        <ProviderCatalogue items={catalogueItems} />
      )}

      <ConnectorSetupDialogs controller={controller.connectorSetup} />
      <ConnectorDetailsModal
        connector={controller.selectedConnector}
        onOpenChange={(open) => !open && controller.setSelectedConnector(null)}
        onConnect={(connector) => {
          controller.setSelectedConnector(null);
          void controller.connectorSetup.connect(connector);
        }}
        onDisconnect={(connector) => {
          controller.setSelectedConnector(null);
          controller.setConnectorToDisconnect(connector);
        }}
        isStarting={controller.connectorSetup.isStarting}
        isDisconnecting={controller.isDisconnecting}
        accountsSlot={
          controller.selectedConnector ? (
            <ConnectorAccountsPanel
              provider={controller.selectedConnector.id}
              providerName={controller.selectedConnector.name}
            />
          ) : null
        }
      />
      <ConfirmationDialog
        open={controller.connectorToDisconnect !== null}
        onOpenChange={(open) => !open && controller.setConnectorToDisconnect(null)}
        title="Disconnect Connector"
        description={
          controller.connectorToDisconnect
            ? `Disconnect ${controller.connectorToDisconnect.name}? Recipes using it will stop working until you reconnect.`
            : ""
        }
        confirmText="Disconnect Connector"
        variant="destructive"
        onConfirm={controller.disconnect}
        isLoading={controller.isDisconnecting}
      />
    </section>
  );
}
