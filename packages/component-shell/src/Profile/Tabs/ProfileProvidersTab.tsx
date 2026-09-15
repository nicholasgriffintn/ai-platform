import {
  ProviderCatalogue,
  type ProviderCatalogueItem,
  ProviderFilterBar,
} from "@ngriffin_uk/polychat-component-account";
import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmationDialog,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import type { ProviderSetting } from "@ngriffin_uk/polychat-library-client";
import { useTrackEvent, useUser } from "@ngriffin_uk/polychat-library-react";
import { formatProviderLabel } from "@ngriffin_uk/polychat-schemas";
import { RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { ProviderApiKeyModal } from "../Modals/ProviderApiKeyModal.js";
import { ProfileTab } from "../ProfileTabLayout.js";

interface ProviderModalState {
  open: boolean;
  providerId: string;
  providerName: string;
}

interface ProviderDeleteState {
  providerId: string;
  providerName: string;
}

type ProviderTypeFilter = "all" | "connected" | "chat" | "messaging";

function readProviderTypeFilter(value: string | null): ProviderTypeFilter {
  switch (value) {
    case "connected":
    case "chat":
    case "messaging":
      return value;
    case null:
    default:
      return "all";
  }
}

export function ProfileProvidersTab() {
  const { trackEvent } = useTrackEvent();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    providerSettings,
    isLoadingProviderSettings,
    providerSyncRequired,
    isLoadingProviderSyncStatus,
    syncProviders,
    isSyncingProviders,
    deleteProviderApiKey,
    isDeletingProviderApiKey,
  } = useUser();
  const [modalState, setModalState] = useState<ProviderModalState>({
    open: false,
    providerId: "",
    providerName: "",
  });
  const [providerToDelete, setProviderToDelete] = useState<ProviderDeleteState | null>(null);
  const providerType = readProviderTypeFilter(searchParams.get("type"));
  const [providerSearch, setProviderSearch] = useState("");
  const configuredProviderCount = providerSettings.filter((provider) => provider.hasApiKey).length;
  const providerCounts = useMemo(
    () => ({
      all: providerSettings.length,
      connected: configuredProviderCount,
      chat: providerSettings.filter((provider) => provider.type === "chat").length,
      messaging: providerSettings.filter((provider) => provider.type === "messaging").length,
    }),
    [configuredProviderCount, providerSettings],
  );
  const modalProvider = useMemo(
    () => providerSettings.find((provider) => provider.provider_id === modalState.providerId),
    [modalState.providerId, providerSettings],
  );

  const getProviderName = (provider: ProviderSetting) =>
    provider.name || formatProviderLabel(provider.provider_id);
  const handleEnableProvider = (providerId: string, providerName: string) => {
    trackEvent({
      name: "open_enable_provider_modal",
      category: "profile",
      label: "enable_provider",
      value: providerId,
    });
    setModalState({
      open: true,
      providerId,
      providerName,
    });
  };

  const handleCloseModal = (open: boolean) => {
    trackEvent({
      name: "close_enable_provider_modal",
      category: "profile",
      label: "enable_provider",
      value: "",
    });
    setModalState({
      open,
      providerId: "",
      providerName: "",
    });
  };

  const handleDeleteProvider = async () => {
    if (!providerToDelete) {
      return;
    }

    trackEvent({
      name: "delete_provider_api_key",
      category: "profile",
      label: "delete_provider",
      value: providerToDelete.providerId,
    });
    await deleteProviderApiKey({ providerId: providerToDelete.providerId });
    setProviderToDelete(null);
  };

  const handleProviderTypeChange = (value: string) => {
    const nextType = value as ProviderTypeFilter;
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextType === "all") {
      nextSearchParams.delete("type");
    } else {
      nextSearchParams.set("type", nextType);
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const normalisedSearch = providerSearch.trim().toLowerCase();
  const catalogueItems: ProviderCatalogueItem[] = providerSettings
    .map((provider): ProviderCatalogueItem & { type: ProviderTypeFilter } => {
      const providerName = getProviderName(provider);
      const isConfigured = Boolean(provider.hasApiKey);

      return {
        id: `provider:${provider.provider_id}`,
        name: providerName,
        description: provider.webhookUrl ?? provider.description,
        category: provider.type === "messaging" ? "Messaging" : "AI models",
        connected: isConfigured,
        type: provider.type === "messaging" ? "messaging" : "chat",
        icon: (
          <ModelIcon
            modelName={providerName}
            provider={provider.provider_id}
            size={28}
            showFallback
            mono
          />
        ),
        onSelect: () => handleEnableProvider(provider.provider_id, providerName),
      };
    })
    .filter((item) => {
      if (providerType === "connected" && !item.connected) {
        return false;
      }

      if (!["all", "connected"].includes(providerType) && item.type !== providerType) {
        return false;
      }

      if (!normalisedSearch) {
        return true;
      }

      return `${item.name} ${item.description ?? ""} ${item.category}`
        .toLowerCase()
        .includes(normalisedSearch);
    });

  return (
    <ProfileTab
      title="Available Providers"
      actions={
        !isLoadingProviderSettings
          ? [
              {
                label: isSyncingProviders ? "Syncing..." : "Sync Providers",
                onClick: () => syncProviders(),
                icon: <RefreshCcw className="mr-2 h-4 w-4" />,
                disabled: isSyncingProviders,
                variant: "secondary",
              },
            ]
          : []
      }
    >
      <div className="space-y-6">
        {!isLoadingProviderSyncStatus && providerSyncRequired && (
          <Alert variant="warning" aria-label="Provider catalogue needs syncing">
            <AlertTitle>Provider catalogue needs syncing</AlertTitle>
            <AlertDescription>
              <p>
                New providers have not been synced to your account yet. Sync providers to make them
                available for configuration.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => syncProviders()}
                disabled={isSyncingProviders}
              >
                {isSyncingProviders ? "Syncing providers…" : "Sync providers now"}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!isLoadingProviderSettings && providerSettings.length > 0 && (
          <ProviderFilterBar
            counts={providerCounts}
            activeType={providerType}
            onActiveTypeChange={handleProviderTypeChange}
            search={providerSearch}
            onSearchChange={setProviderSearch}
          />
        )}

        {isLoadingProviderSettings ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
        ) : providerSettings.length === 0 ? (
          <EmptyState
            message="No providers available"
            className="border-none bg-transparent px-0 py-10 dark:bg-transparent"
          />
        ) : catalogueItems.length === 0 ? (
          <EmptyState
            message={
              providerSearch ? "No providers match your search" : "No providers in this view"
            }
            className="border-none bg-transparent px-0 py-10 dark:bg-transparent"
          />
        ) : (
          <ProviderCatalogue items={catalogueItems} />
        )}
      </div>

      <ProviderApiKeyModal
        open={modalState.open}
        onOpenChange={handleCloseModal}
        providerId={modalState.providerId}
        providerName={modalState.providerName}
        configurationFields={modalProvider?.configurationFields}
        configurationValues={modalProvider?.configurationValues}
        hasStoredCredentials={modalProvider?.hasApiKey}
        webhookUrl={modalProvider?.webhookUrl}
        onDelete={
          modalProvider?.hasApiKey
            ? () => {
                setProviderToDelete({
                  providerId: modalProvider.provider_id,
                  providerName: getProviderName(modalProvider),
                });
                handleCloseModal(false);
              }
            : undefined
        }
        isDeleting={isDeletingProviderApiKey}
      />
      <ConfirmationDialog
        open={providerToDelete !== null}
        onOpenChange={(open) => !open && setProviderToDelete(null)}
        title="Delete Provider"
        description={
          providerToDelete
            ? `Delete the stored credentials for ${providerToDelete.providerName}? The provider will be disabled until you add a new key.`
            : ""
        }
        confirmText="Delete Provider"
        variant="destructive"
        onConfirm={handleDeleteProvider}
        isLoading={isDeletingProviderApiKey}
      />
    </ProfileTab>
  );
}
