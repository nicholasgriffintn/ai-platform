import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Button,
} from "@ngriffin_uk/polychat-component-ui";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { parseGitHubRepositoryList } from "./repositories";

export interface SandboxConnectionFormState {
  installationId: string;
  appId: string;
  privateKey: string;
  webhookSecret: string;
  repositories: string;
}

export interface SandboxConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connection: {
    installationId: number;
    appId: string;
    privateKey: string;
    webhookSecret?: string;
    repositories: string[];
  }) => Promise<void>;
  isSaving?: boolean;
  onValidationError?: (message: string) => void;
  onOpenGitHubInstall?: () => void;
  form: SandboxConnectionFormState;
  setForm: React.Dispatch<React.SetStateAction<SandboxConnectionFormState>>;
}

export const SandboxConnectionDialog = ({
  isOpen,
  onClose,
  onSave,
  isSaving = false,
  onValidationError,
  onOpenGitHubInstall,
  form,
  setForm,
}: SandboxConnectionDialogProps) => {
  const [configureManually, setConfigureManually] = useState(false);

  const handleSaveConnection = async () => {
    const installationId = Number(form.installationId);

    if (!Number.isFinite(installationId) || installationId <= 0) {
      onValidationError?.("Installation ID must be a positive number");

      return;
    }

    if (!form.appId.trim() || !form.privateKey.trim()) {
      onValidationError?.("App ID and private key are required");

      return;
    }

    await onSave({
      installationId,
      appId: form.appId.trim(),
      privateKey: form.privateKey.trim(),
      webhookSecret: form.webhookSecret.trim() || undefined,
      repositories: parseGitHubRepositoryList(form.repositories) ?? [],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add GitHub connection</DialogTitle>
          <DialogDescription>
            Use our GitHub App installation for an automated setup, or set up your own connection
            manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!configureManually ? (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">Install GitHub App</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Install the GitHub App on your account or organization to allow the sandbox to
                automatically create branches, commits, and pull requests for your runs.
              </p>
              <div className="mt-3">
                <Button
                  variant="primary"
                  icon={<ExternalLink className="h-4 w-4" />}
                  onClick={onOpenGitHubInstall}
                  disabled={!onOpenGitHubInstall}
                >
                  Install GitHub App
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sandbox-installation-id">Installation ID</Label>
                  <Input
                    id="sandbox-installation-id"
                    type="number"
                    placeholder="12345678"
                    value={form.installationId}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        installationId: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sandbox-app-id">GitHub App ID</Label>
                  <Input
                    id="sandbox-app-id"
                    placeholder="123456"
                    value={form.appId}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        appId: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sandbox-private-key">GitHub App private key</Label>
                <Textarea
                  id="sandbox-private-key"
                  rows={6}
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  value={form.privateKey}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      privateKey: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sandbox-webhook-secret">Webhook secret (optional)</Label>
                <Input
                  id="sandbox-webhook-secret"
                  placeholder="Webhook signing secret"
                  value={form.webhookSecret}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      webhookSecret: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sandbox-repositories">Allowed repositories (optional)</Label>
                <Textarea
                  id="sandbox-repositories"
                  rows={3}
                  placeholder="owner/repo-a, owner/repo-b"
                  value={form.repositories}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      repositories: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to allow this installation to run against any repository it can
                  access.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!configureManually ? (
            <Button variant="outline" onClick={() => setConfigureManually(true)}>
              Configure manually
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConfigureManually(false)}>
                Use GitHub App installation
              </Button>
              <Button
                variant="primary"
                icon={<ShieldCheck className="h-4 w-4" />}
                onClick={handleSaveConnection}
                isLoading={isSaving}
              >
                Save connection
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
