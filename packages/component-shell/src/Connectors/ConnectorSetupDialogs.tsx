import { ConnectorAuthConfigModal } from "@ngriffin_uk/polychat-component-account";
import type { ConnectorSetupController } from "@ngriffin_uk/polychat-library-react";

import { ConnectorApiKeyModal } from "./ConnectorApiKeyModal.js";

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
