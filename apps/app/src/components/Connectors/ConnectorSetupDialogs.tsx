import { ConnectorApiKeyModal } from "~/components/Profile/Modals/ConnectorApiKeyModal";
import { ConnectorAuthConfigModal } from "~/components/Profile/Modals/ConnectorAuthConfigModal";
import type { ConnectorSetupController } from "~/hooks/useConnectorSetup";

export function ConnectorSetupDialogs({ controller }: { controller: ConnectorSetupController }) {
	return (
		<>
			<ConnectorApiKeyModal
				open={controller.apiKeyDialog.open}
				onOpenChange={controller.closeApiKeyDialog}
				providerId={controller.apiKeyDialog.providerId}
				providerName={controller.apiKeyDialog.providerName}
				credentialLabel={controller.apiKeyDialog.credentialLabel}
				onStored={controller.onApiKeyStored}
			/>
			<ConnectorAuthConfigModal
				configs={controller.authConfigDialog.configs}
				providerName={controller.authConfigDialog.connector?.name ?? "connector"}
				isLoading={controller.isStarting}
				onOpenChange={controller.closeAuthConfigDialog}
				onSelect={controller.selectAuthConfig}
			/>
		</>
	);
}
