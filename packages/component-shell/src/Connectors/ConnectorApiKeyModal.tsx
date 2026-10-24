import { ConnectorApiKeyModal as ControlledConnectorApiKeyModal } from "@ngriffin_uk/polychat-component-account";
import { useStoreRecipeConnectorApiKey } from "@ngriffin_uk/polychat-library-react";
import type {
  RecipeConnectorManifest,
  RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";
import { toast } from "sonner";

import { CopyButton } from "../Content/CopyButton.js";

interface ConnectorApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: RecipeConnectorProvider | null;
  providerName: string;
  credentialFields?: RecipeConnectorManifest["credentialFields"];
  callbackUrl?: string;
  onStored: () => Promise<void> | void;
}

export function ConnectorApiKeyModal({
  open,
  onOpenChange,
  providerId,
  providerName,
  credentialFields,
  callbackUrl,
  onStored,
}: ConnectorApiKeyModalProps) {
  const storeApiKey = useStoreRecipeConnectorApiKey();

  return (
    <ControlledConnectorApiKeyModal
      open={open}
      providerName={providerName}
      credentialFields={credentialFields}
      callbackUrl={callbackUrl}
      renderCopyButton={(value) => <CopyButton value={value} />}
      isSubmitting={storeApiKey.isPending}
      onOpenChange={onOpenChange}
      onSubmit={async (credentials) => {
        if (!providerId) {
          return;
        }

        try {
          await storeApiKey.mutateAsync({ provider: providerId, credentials });
          await onStored();
          toast.success(`${providerName} connected.`);
          onOpenChange(false);
        } catch (error) {
          console.error(error);
          toast.error(`Could not connect ${providerName}.`);
        }
      }}
    />
  );
}
