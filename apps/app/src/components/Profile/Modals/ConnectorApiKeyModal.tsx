import { ConnectorApiKeyModal as ControlledConnectorApiKeyModal } from "@ngriffin_uk/polychat-component-account";
import { useStoreRecipeConnectorApiKey } from "@ngriffin_uk/polychat-library-react";
import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";
import { toast } from "sonner";

interface ConnectorApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: RecipeConnectorProvider | null;
  providerName: string;
  credentialLabel?: string;
  onStored: () => Promise<void> | void;
}

export function ConnectorApiKeyModal({
  open,
  onOpenChange,
  providerId,
  providerName,
  credentialLabel,
  onStored,
}: ConnectorApiKeyModalProps) {
  const storeApiKey = useStoreRecipeConnectorApiKey();

  return (
    <ControlledConnectorApiKeyModal
      open={open}
      providerName={providerName}
      credentialLabel={credentialLabel}
      isSubmitting={storeApiKey.isPending}
      onOpenChange={onOpenChange}
      onSubmit={async (apiKey) => {
        if (!providerId || !apiKey) {
          return;
        }

        try {
          await storeApiKey.mutateAsync({ provider: providerId, apiKey });
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
