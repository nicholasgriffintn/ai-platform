import {
  SandboxConnectionDialog,
  type SandboxConnectionFormState,
} from "@ngriffin_uk/polychat-component-account";
import { toast } from "sonner";

import { useSandboxInstallConfig, useUpsertSandboxConnection } from "~/hooks/useSandbox";

interface SandboxAddGitHubConnectionProps {
  isOpen: boolean;
  onClose: () => void;
  form: SandboxConnectionFormState;
  setForm: React.Dispatch<React.SetStateAction<SandboxConnectionFormState>>;
}

export const SandboxAddGitHubConnection = ({
  isOpen,
  onClose,
  form,
  setForm,
}: SandboxAddGitHubConnectionProps) => {
  const upsertConnectionMutation = useUpsertSandboxConnection();
  const { data: installConfig } = useSandboxInstallConfig();

  return (
    <SandboxConnectionDialog
      isOpen={isOpen}
      onClose={onClose}
      form={form}
      setForm={setForm}
      isSaving={upsertConnectionMutation.isPending}
      onValidationError={(message) => toast.error(message)}
      onOpenGitHubInstall={
        installConfig?.installUrl
          ? () => window.open(installConfig.installUrl, "_blank", "noopener")
          : undefined
      }
      onSave={async (connection) => {
        try {
          await upsertConnectionMutation.mutateAsync(connection);
          toast.success("GitHub connection saved");
          onClose();
        } catch (mutationError) {
          toast.error(
            mutationError instanceof Error ? mutationError.message : "Failed to save connection",
          );
        }
      }}
    />
  );
};
