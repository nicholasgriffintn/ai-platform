import { SandboxConnectionList } from "@ngriffin_uk/polychat-component-account";
import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { SandboxAddGitHubConnection } from "~/components/Models/SandboxAddGitHubConnection";
import { ProfileTab } from "~/components/Profile/ProfileTabLayout";
import {
  useConnectSandboxInstallation,
  useDeleteSandboxConnection,
  useSandboxConnections,
  useSandboxInstallConfig,
} from "~/hooks/useSandbox";
import { isAuthenticationError } from "~/lib/errors";
import { useUIStore } from "~/state/stores/uiStore";

interface ConnectionFormState {
  installationId: string;
  appId: string;
  privateKey: string;
  webhookSecret: string;
  repositories: string;
}

const INITIAL_FORM: ConnectionFormState = {
  installationId: "",
  appId: "",
  privateKey: "",
  webhookSecret: "",
  repositories: "",
};

export function ProfileSandboxTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [form, setForm] = useState<ConnectionFormState>(INITIAL_FORM);
  const [installationIdToDelete, setInstallationIdToDelete] = useState<number | null>(null);
  const processedInstallationRef = useRef<string | null>(null);

  const { data: connections = [], isLoading, error } = useSandboxConnections();
  const { data: installConfig, isLoading: isInstallConfigLoading } = useSandboxInstallConfig();
  const connectInstallationMutation = useConnectSandboxInstallation();
  const deleteConnectionMutation = useDeleteSandboxConnection();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  useEffect(() => {
    const rawInstallationId =
      searchParams.get("installation_id") || searchParams.get("installationId");

    if (!rawInstallationId) {
      processedInstallationRef.current = null;

      return;
    }

    if (processedInstallationRef.current === rawInstallationId) {
      return;
    }

    processedInstallationRef.current = rawInstallationId;

    if (isInstallConfigLoading) {
      processedInstallationRef.current = null;

      return;
    }

    const clearInstallParams = () => {
      const next = new URLSearchParams(searchParams);

      next.delete("installation_id");
      next.delete("installationId");
      next.delete("setup_action");
      next.delete("state");
      next.set("tab", "sandbox");
      setSearchParams(next, { replace: true });
    };

    const installationId = Number(rawInstallationId);

    if (!Number.isFinite(installationId) || installationId <= 0) {
      toast.error("GitHub installation id in callback URL is invalid");
      clearInstallParams();

      return;
    }

    if (!installConfig?.canAutoConnect) {
      toast.info("GitHub install detected. Open Add connection and save it manually.");
      clearInstallParams();
      setIsConnectionModalOpen(true);
      setForm((prev) => ({ ...prev, installationId: String(installationId) }));

      return;
    }

    void (async () => {
      try {
        await connectInstallationMutation.mutateAsync({ installationId });
        toast.success(`Connected GitHub installation ${installationId}`);
      } catch (connectError) {
        toast.error(
          connectError instanceof Error
            ? connectError.message
            : "Failed to connect GitHub installation",
        );
      } finally {
        clearInstallParams();
      }
    })();
  }, [
    connectInstallationMutation,
    installConfig?.canAutoConnect,
    isInstallConfigLoading,
    searchParams,
    setSearchParams,
  ]);

  const handleDeleteConnection = async () => {
    if (installationIdToDelete === null) {
      return;
    }

    try {
      await deleteConnectionMutation.mutateAsync(installationIdToDelete);
      toast.success("Connection deleted");
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Failed to delete connection",
      );
    }

    setInstallationIdToDelete(null);
  };

  return (
    <ProfileTab
      title="Sandbox"
      actions={[
        {
          label: "Add GitHub connection",
          icon: <Plus className="h-4 w-4" />,
          onClick: () => setIsConnectionModalOpen(true),
        },
      ]}
      description="Connect GitHub installations used by Sandbox chat mode."
    >
      <SandboxConnectionList
        connections={connections}
        isLoading={isLoading}
        requiresSignIn={isAuthenticationError(error)}
        loadErrorMessage={
          !isAuthenticationError(error) && error
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined
        }
        onSignIn={() => setShowLoginModal(true)}
        onDelete={setInstallationIdToDelete}
        deletingInstallationId={
          deleteConnectionMutation.isPending ? (deleteConnectionMutation.variables ?? null) : null
        }
      />

      <SandboxAddGitHubConnection
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        form={form}
        setForm={setForm}
      />

      <ConfirmationDialog
        open={installationIdToDelete !== null}
        onOpenChange={(open) => !open && setInstallationIdToDelete(null)}
        title="Delete connection"
        description={
          installationIdToDelete === null
            ? ""
            : `Delete the connection for installation ${installationIdToDelete}? Sandbox tasks using it will stop working.`
        }
        confirmText="Delete connection"
        variant="destructive"
        isLoading={deleteConnectionMutation.isPending}
        onConfirm={handleDeleteConnection}
      />
    </ProfileTab>
  );
}
