import { ConnectorDetailsModal } from "@ngriffin_uk/polychat-component-account";
import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectCapabilityKindGroup } from "@ngriffin_uk/polychat-library-react";
import type { ReactNode } from "react";

import { CapabilityLibrary } from "../Capabilities/CapabilityLibrary.js";
import {
  PLUGIN_LIBRARY_KINDS,
  type CapabilityLibraryScope,
} from "../Capabilities/useCapabilityLibraryController.js";
import { ConnectorAccountsPanel } from "../Connectors/ConnectorAccountsPanel.js";
import { ConnectorSetupDialogs } from "../Connectors/ConnectorSetupDialogs.js";
import { PluginsConnectorGroup } from "./PluginsConnectorGroup.js";
import { usePluginsController } from "./usePluginsController.js";

export function PluginsLibrary({
  scope,
  projectName,
}: {
  scope: CapabilityLibraryScope;
  projectName?: string;
}) {
  const controller = usePluginsController();

  const renderGroup = (group: ProjectCapabilityKindGroup): ReactNode => {
    if (group.kind !== "connector") {
      return null;
    }

    return (
      <PluginsConnectorGroup
        group={group}
        manifestsById={controller.manifestsById}
        connectingProviderId={controller.connectorSetup.connectingProviderId}
        onSelect={controller.setSelectedConnector}
      />
    );
  };

  return (
    <CapabilityLibrary
      scope={scope}
      kinds={PLUGIN_LIBRARY_KINDS}
      extraItems={controller.items}
      renderGroup={renderGroup}
      title="Plugins"
      subtitle={
        projectName
          ? `The apps, skills, tools and integrations ${projectName} can use.`
          : "The apps, skills, tools and integrations Polychat can use on your behalf."
      }
    >
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
    </CapabilityLibrary>
  );
}
