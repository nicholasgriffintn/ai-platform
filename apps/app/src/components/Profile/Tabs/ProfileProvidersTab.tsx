import { Plus, Power, RefreshCcw } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { useUser } from "~/hooks/useUser";
import { ProviderApiKeyModal } from "../Modals/ProviderApiKeyModal";

interface ProviderSetting {
  id: string;
  provider_id: string;
  name?: string;
  description?: string;
  enabled: boolean;
}

interface ProviderModalState {
  open: boolean;
  providerId: string;
  providerName: string;
}

export function ProfileProvidersTab() {
  const {
    providerSettings,
    isLoadingProviderSettings,
    syncProviders,
    isSyncingProviders,
  } = useUser();
  const [modalState, setModalState] = useState<ProviderModalState>({
    open: false,
    providerId: "",
    providerName: "",
  });

  const handleEnableProvider = (providerId: string, providerName: string) => {
    setModalState({
      open: true,
      providerId,
      providerName,
    });
  };

  const handleCloseModal = (open: boolean) => {
    setModalState({
      open,
      providerId: "",
      providerName: "",
    });
  };

  return (
    <div>
      <PageHeader
        actions={
          !isLoadingProviderSettings
            ? [
                {
                  label: isSyncingProviders ? "Syncing..." : "Sync Providers",
                  onClick: () => syncProviders(),
                  icon: <RefreshCcw className="h-4 w-4 mr-2" />,
                  disabled: isSyncingProviders,
                  variant: "secondary",
                },
              ]
            : []
        }
      >
        <PageTitle title="Available Providers" />
      </PageHeader>

      <div className="space-y-4">
        {isLoadingProviderSettings ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
        ) : !providerSettings || Object.keys(providerSettings).length === 0 ? (
          <div className="text-center py-10 text-zinc-500 dark:text-zinc-400">
            No providers available
          </div>
        ) : (
          <>
            {Object.entries(providerSettings).map(([providerId, provider]) => (
              <Card key={providerId} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {(provider as ProviderSetting).name ||
                        (provider as ProviderSetting).provider_id}
                    </h3>
                    {(provider as ProviderSetting).description && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {(provider as ProviderSetting).description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant={
                      (provider as ProviderSetting).enabled
                        ? "secondary"
                        : "default"
                    }
                    size="sm"
                    onClick={() =>
                      handleEnableProvider(
                        (provider as ProviderSetting).id,
                        (provider as ProviderSetting).name ||
                          (provider as ProviderSetting).provider_id,
                      )
                    }
                    className="flex items-center gap-2"
                    icon={
                      (provider as ProviderSetting).enabled ? (
                        <Power className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )
                    }
                  >
                    {(provider as ProviderSetting).enabled
                      ? "Configure"
                      : "Enable"}
                  </Button>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>

      <ProviderApiKeyModal
        open={modalState.open}
        onOpenChange={handleCloseModal}
        providerId={modalState.providerId}
        providerName={modalState.providerName}
      />
    </div>
  );
}
