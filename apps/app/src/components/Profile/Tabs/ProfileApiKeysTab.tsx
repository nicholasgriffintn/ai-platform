import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "~/components/EmptyState";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FormInput,
} from "~/components/ui";
import { Card } from "~/components/ui/Card";
import { useApiKeys } from "~/hooks/useApiKeys";
import { PageHeader } from "../../PageHeader";
import { PageTitle } from "../../PageTitle";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    console.log("API Key copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

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
          <div className="bg-zinc-100 dark:bg-zinc-700 p-3 rounded-md flex items-center justify-between">
            <code className="text-sm text-zinc-700 dark:text-zinc-200 break-all">
              {apiKey}
            </code>
            <Button
              variant="icon"
              size="sm"
              onClick={handleCopy}
              aria-label="Copy API Key"
              title="Copy API Key"
            >
              <Copy className={`h-4 w-4 ${copied ? "text-green-500" : ""}`} />
            </Button>
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

function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  apiKeyName,
  isDeleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  apiKeyName: string;
  isDeleting: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogClose onClick={onClose} />
        </DialogHeader>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {`Are you sure you want to delete the API key "${apiKeyName}"? This action cannot be undone.`}
        </p>
        <div className="flex justify-end space-x-3 mt-6">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
              </>
            ) : (
              "Delete Key"
            )}
          </Button>
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
              <ul className="space-y-3">
                {apiKeys.map((key) => (
                  <li
                    key={key.id}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">
                        {key.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Created: {formatDate(key.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(key.id, key.name)}
                      disabled={isDeletingApiKey && keyToDelete?.id === key.id}
                      aria-label={`Delete API key ${key.name}`}
                      title={`Delete API key ${key.name}`}
                    >
                      {isDeletingApiKey && keyToDelete?.id === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
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

        {keyToDelete && (
          <ConfirmDeleteModal
            isOpen={!!keyToDelete}
            onClose={() => setKeyToDelete(null)}
            onConfirm={handleConfirmDelete}
            apiKeyName={keyToDelete.name}
            isDeleting={isDeletingApiKey && keyToDelete?.id === keyToDelete.id}
          />
        )}
      </div>
    </div>
  );
}
