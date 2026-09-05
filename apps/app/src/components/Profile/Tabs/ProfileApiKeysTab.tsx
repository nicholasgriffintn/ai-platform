import { ApiKeysPanel, type GeneratedApiKey } from "@ngriffin_uk/polychat-component-account";
import { useState } from "react";
import { toast } from "sonner";

import { CopyButton } from "~/components/Content/CopyButton";
import { ProfileTab } from "~/components/Profile/ProfileTabLayout";
import { useApiKeys } from "~/hooks/useApiKeys";
import { isAuthenticationError } from "~/lib/errors";
import { useUIStore } from "~/state/stores/uiStore";

export function ProfileApiKeysTab() {
  const {
    apiKeys,
    isLoadingApiKeys,
    errorLoadingApiKeys,
    createApiKey,
    isCreatingApiKey,
    errorCreatingApiKey,
    deleteApiKey,
    isDeletingApiKey,
  } = useApiKeys();

  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
  const [generatedKey, setGeneratedKey] = useState<GeneratedApiKey | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  const requiresSignIn = isAuthenticationError(errorLoadingApiKeys);

  return (
    <ProfileTab title="API Keys">
      <ApiKeysPanel
        apiKeys={apiKeys}
        isLoading={isLoadingApiKeys}
        requiresSignIn={requiresSignIn}
        loadErrorMessage={
          !requiresSignIn && errorLoadingApiKeys ? errorLoadingApiKeys.message : undefined
        }
        onSignIn={() => setShowLoginModal(true)}
        onCreate={async (name) => {
          try {
            const result = await createApiKey({ name });

            setGeneratedKey({ key: result.apiKey, name: result.name });
          } catch (error: any) {
            const message = `Failed to create API key: ${error.message || "Unknown error"}`;

            toast.error(message);
            console.error(message, error);
          }
        }}
        isCreating={isCreatingApiKey}
        createErrorMessage={errorCreatingApiKey?.message}
        generatedKey={generatedKey}
        onDismissGeneratedKey={() => setGeneratedKey(null)}
        renderCopyButton={(value) => <CopyButton value={value} variant="icon" iconSize={16} />}
        onDelete={(keyId) => {
          setDeletingKeyId(keyId);
          deleteApiKey(
            { keyId },
            {
              onSettled: () => setDeletingKeyId(null),
              onError: (error) => {
                const message = `Failed to delete API key: ${error.message || "Unknown error"}`;

                toast.error(message);
                console.error(message, error);
              },
            },
          );
        }}
        isDeleting={isDeletingApiKey}
        deletingKeyId={deletingKeyId}
      />
    </ProfileTab>
  );
}
