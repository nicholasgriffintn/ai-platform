import {
  Button,
  ConfirmationDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormInput,
  HoverActions,
  ListItem,
  SignInEmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { SettingsSection } from "../SettingsSection";

export interface ApiKeySummary {
  id: string;
  name: string;
  created_at: string;
}

export interface GeneratedApiKey {
  key: string;
  name: string;
}

export interface ApiKeysPanelProps {
  apiKeys: ApiKeySummary[];
  isLoading?: boolean;
  loadErrorMessage?: string;
  requiresSignIn?: boolean;
  onSignIn: () => void;
  onCreate: (name: string | undefined) => void | Promise<void>;
  isCreating?: boolean;
  createErrorMessage?: string;
  generatedKey: GeneratedApiKey | null;
  onDismissGeneratedKey: () => void;
  renderCopyButton: (value: string) => ReactNode;
  onDelete: (keyId: string) => void;
  isDeleting?: boolean;
  deletingKeyId?: string | null;
}

function formatCreatedAt(dateString: string): string {
  try {
    const date = new Date(dateString);

    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch {
    return "Invalid Date";
  }
}

function GeneratedApiKeyModal({
  generatedKey,
  onClose,
  renderCopyButton,
}: {
  generatedKey: GeneratedApiKey;
  onClose: () => void;
  renderCopyButton: (value: string) => ReactNode;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`API Key Created: ${generatedKey.name}`}</DialogTitle>
        </DialogHeader>
        <p className="mt-2 text-sm text-muted-foreground">
          Please copy your new API key. You won't be able to see it again!
        </p>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-md bg-selection p-3">
            <code className="flex-1 text-sm break-all text-foreground">{generatedKey.key}</code>
            {renderCopyButton(generatedKey.key)}
          </div>
          <p className="text-xs font-medium text-attention">
            Store this key securely. It grants access to your account.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysPanel({
  apiKeys,
  isLoading = false,
  loadErrorMessage,
  requiresSignIn = false,
  onSignIn,
  onCreate,
  isCreating = false,
  createErrorMessage,
  generatedKey,
  onDismissGeneratedKey,
  renderCopyButton,
  onDelete,
  isDeleting = false,
  deletingKeyId = null,
}: ApiKeysPanelProps) {
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [keyToDelete, setKeyToDelete] = useState<ApiKeySummary | null>(null);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    await onCreate(newApiKeyName || undefined);
    setNewApiKeyName("");
  };

  return (
    <div className="space-y-8">
      <SettingsSection
        title="Generate New API Key"
        description="Create a new key to use with external applications or scripts."
      >
        <form
          onSubmit={(event) => {
            void handleCreate(event);
          }}
          className="space-y-4"
        >
          <FormInput
            id="new-api-key-name"
            label="Key Name (Optional)"
            placeholder="e.g., My Script Key"
            value={newApiKeyName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setNewApiKeyName(event.target.value)
            }
            disabled={isCreating}
          />
          {createErrorMessage && (
            <p className="text-sm text-failure">Error: {createErrorMessage}</p>
          )}
          <Button type="submit" variant="primary" disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> Generate Key
              </>
            )}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Existing API Keys"
        description="Manage your existing API keys. Remember to delete keys that are no longer needed."
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading keys...</span>
          </div>
        ) : requiresSignIn ? (
          <SignInEmptyState
            title="Sign in to view API keys"
            message="Sign in to manage the API keys connected to your account."
            className="bg-transparent px-0 py-6 dark:bg-transparent"
            onSignIn={onSignIn}
          />
        ) : loadErrorMessage ? (
          <p className="py-6 text-center text-failure">
            Error loading API keys: {loadErrorMessage}
          </p>
        ) : apiKeys.length === 0 ? (
          <EmptyState
            message="You haven't generated any API keys yet."
            className="bg-transparent px-0 py-6 dark:bg-transparent"
          />
        ) : (
          <ul className="space-y-2">
            {apiKeys.map((key) => (
              <ListItem
                key={key.id}
                label={key.name}
                className="border border-border bg-surface hover:bg-selection"
                sublabel={`Created: ${formatCreatedAt(key.created_at)}`}
                actions={
                  <HoverActions
                    alwaysVisible
                    actions={[
                      {
                        id: "delete",
                        icon:
                          isDeleting && deletingKeyId === key.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          ),
                        label: `Delete API key ${key.name}`,
                        onClick: (event) => {
                          event.stopPropagation();
                          setKeyToDelete(key);
                        },
                        disabled: isDeleting && deletingKeyId === key.id,
                      },
                    ]}
                  />
                }
              />
            ))}
          </ul>
        )}
      </SettingsSection>

      {generatedKey && (
        <GeneratedApiKeyModal
          generatedKey={generatedKey}
          onClose={onDismissGeneratedKey}
          renderCopyButton={renderCopyButton}
        />
      )}

      <ConfirmationDialog
        open={!!keyToDelete}
        onOpenChange={(open) => !open && setKeyToDelete(null)}
        title="Delete API Key"
        description={
          keyToDelete
            ? `Are you sure you want to delete the API key "${keyToDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete Key"
        variant="destructive"
        onConfirm={() => {
          if (keyToDelete) {
            onDelete(keyToDelete.id);
          }

          setKeyToDelete(null);
        }}
        isLoading={isDeleting}
      />
    </div>
  );
}
