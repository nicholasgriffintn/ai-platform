import { SandboxConnectionList } from "@ngriffin_uk/polychat-component-account";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { PageShell } from "~/components/Core/PageShell";
import { SandboxAddGitHubConnection } from "~/components/Models/SandboxAddGitHubConnection";
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

  const handleDeleteConnection = async (installationId: number) => {
    if (!window.confirm(`Delete the connection for installation ${installationId}?`)) {
      return;
    }

    try {
      await deleteConnectionMutation.mutateAsync(installationId);
      toast.success("Connection deleted");
    } catch (mutationError) {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Failed to delete connection",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageShell.Header
        title="Sandbox"
        actions={[
          {
            label: "Add GitHub connection",
            icon: <Plus className="h-4 w-4" />,
            onClick: () => setIsConnectionModalOpen(true),
          },
        ]}
      />
      <p className="max-w-3xl text-sm text-muted-foreground">
        Connect GitHub installations used by Sandbox chat mode.
      </p>

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
        onDelete={handleDeleteConnection}
        isDeleting={deleteConnectionMutation.isPending}
      />

      <SandboxAddGitHubConnection
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        form={form}
        setForm={setForm}
      />
    </div>
  );
}
