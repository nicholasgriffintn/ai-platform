import {
  ProviderApiKeyModal as ControlledProviderApiKeyModal,
  type ProviderApiKeyModalProps as ControlledProviderApiKeyModalProps,
} from "@ngriffin_uk/polychat-component-account";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useUser } from "~/hooks/useUser";

type ProviderApiKeyModalProps = Omit<
  ControlledProviderApiKeyModalProps,
  "isSubmitting" | "onSubmit"
>;

export function ProviderApiKeyModal(props: ProviderApiKeyModalProps) {
  const { trackEvent } = useTrackEvent();
  const { storeProviderApiKey, isStoringProviderApiKey } = useUser();

  return (
    <ControlledProviderApiKeyModal
      {...props}
      isSubmitting={isStoringProviderApiKey}
      onSubmit={async ({ apiKey, secretKey, configuration }) => {
        trackEvent({
          name: "store_provider_api_key",
          category: "profile",
          label: "enable_provider",
          value: props.providerId,
        });
        await storeProviderApiKey({
          providerId: props.providerId,
          apiKey,
          secretKey,
          configuration,
        });
      }}
    />
  );
}
