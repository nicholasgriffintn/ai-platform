import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "~/components/Core/EmptyState";
import {
  Button,
  ConfirmationDialog,
  CopyButton,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FormInput,
  HoverActions,
  ListItem,
} from "~/components/ui";
import { Card } from "~/components/ui/Card";
import { useApiKeys } from "~/hooks/useApiKeys";
import { PageHeader } from "../../Core/PageHeader";
import { PageTitle } from "../../Core/PageTitle";

function GeneratedApiKeyModal({
  isOpen,
  onClose,
  apiKey,
  apiKeyName,
}: {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  apiKeyName: string;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`API Key Created: ${apiKeyName}`}</DialogTitle>
          <DialogClose onClick={onClose} />
        </DialogHeader>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Please copy your new API key. You won't be able to see it again!
        </p>
        <div className="space-y-4 mt-4">
          <div className="bg-zinc-100 dark:bg-zinc-700 p-3 rounded-md flex items-center justify-between gap-2">
            <code className="text-sm text-zinc-700 dark:text-zinc-200 break-all flex-1">
              {apiKey}
            </code>
            <CopyButton
              value={apiKey}
              variant="icon"
              iconSize={16}
              onCopy={() => console.log("API Key copied to clipboard!")}
            />
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
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

  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [generatedKeyInfo, setGeneratedKeyInfo] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [keyToDelete, setKeyToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createApiKey({ name: newApiKeyName || undefined });
      setGeneratedKeyInfo({ key: result.apiKey, name: result.name });
      setNewApiKeyName("");
      console.log(`API Key "${result.name}" created successfully!`);
    } catch (error: any) {
      const message = `Failed to create API key: ${error.message || "Unknown error"}`;
      toast.error(message);
      console.error(message, error);
    }
  };

  const handleDeleteClick = (keyId: string, keyName: string) => {
    setKeyToDelete({ id: keyId, name: keyName });
  };

  const handleConfirmDelete = () => {
    if (keyToDelete) {
      deleteApiKey(
        { keyId: keyToDelete.id },
        {
          onSuccess: () => {
            console.log(`API Key "${keyToDelete.name}" deleted.`);
            setKeyToDelete(null);
          },
          onError: (error) => {
            const message = `Failed to delete API key: ${error.message || "Unknown error"}`;
            toast.error(message);
            console.error(message, error);
          },
        },
      );
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch (_e) {
      return "Invalid Date";
    }
  };

  return (
    <div>
      <PageHeader>
        <PageTitle title="API Keys" />
      </PageHeader>
      <div className="space-y-8">
        <Card>
          <div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Generate New API Key
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Create a new key to use with external applications or scripts.
            </p>
          </div>
          <div className="px-6">
            <form onSubmit={handleGenerateKey} className="space-y-4">
              <FormInput
                id="new-api-key-name"
                label="Key Name (Optional)"
                placeholder="e.g., My Script Key"
                value={newApiKeyName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewApiKeyName(e.target.value)
                }
                disabled={isCreatingApiKey}
              />
              {errorCreatingApiKey && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Error: {errorCreatingApiKey.message}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={isCreatingApiKey}
              >
                {isCreatingApiKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> Generate Key
                  </>
                )}
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Existing API Keys
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Manage your existing API keys. Remember to delete keys that are no
              longer needed.
            </p>
          </div>
          <div className="px-6">
            {isLoadingApiKeys ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                  Loading keys...
                </span>
              </div>
            ) : errorLoadingApiKeys ? (
              <p className="text-center text-red-600 dark:text-red-400 py-6">
                Error loading API keys: {errorLoadingApiKeys.message}
              </p>
            ) : apiKeys.length === 0 ? (
              <EmptyState
                message="You haven't generated any API keys yet."
                className="bg-transparent dark:bg-transparent py-6 px-0"
              />
            ) : (
              <ul className="space-y-1">
                {apiKeys.map((key) => (
                  <ListItem
                    key={key.id}
                    label={key.name}
                    sublabel={`Created: ${formatDate(key.created_at)}`}
                    actions={
                      <HoverActions
                        actions={[
                          {
                            id: "delete",
                            icon:
                              isDeletingApiKey && keyToDelete?.id === key.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              ),
                            label: `Delete API key ${key.name}`,
                            onClick: (e) => {
                              e.stopPropagation();
                              handleDeleteClick(key.id, key.name);
                            },
                            disabled:
                              isDeletingApiKey && keyToDelete?.id === key.id,
                          },
                        ]}
                      />
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </Card>

        {generatedKeyInfo && (
          <GeneratedApiKeyModal
            isOpen={!!generatedKeyInfo}
            onClose={() => setGeneratedKeyInfo(null)}
            apiKey={generatedKeyInfo.key}
            apiKeyName={generatedKeyInfo.name}
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
          onConfirm={handleConfirmDelete}
          isLoading={isDeletingApiKey}
        />
      </div>
    </div>
  );
}
