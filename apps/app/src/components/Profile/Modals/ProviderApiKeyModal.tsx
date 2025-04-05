import { useState } from "react";

import { Button } from "~/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/Dialog";
import { TextInput } from "~/components/ui/TextInput";
import { useUser } from "~/hooks/useUser";

interface ProviderApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  providerName: string;
}

export function ProviderApiKeyModal({
  open,
  onOpenChange,
  providerId,
  providerName,
}: ProviderApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const { storeProviderApiKey, isStoringProviderApiKey } = useUser();

  const isBedrockProvider =
    providerName.toLowerCase() === "polly" ||
    providerName.toLowerCase() === "bedrock";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await storeProviderApiKey({
        providerId,
        apiKey,
        secretKey: isBedrockProvider ? secretKey : undefined,
      });
      setApiKey("");
      setSecretKey("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to store API key:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width="500px">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {providerName}</DialogTitle>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isBedrockProvider
              ? `Enter your AWS Access Key ID and Secret Access Key for ${providerName}.`
              : `Enter your API key for ${providerName}.`}
            This will be securely stored and used for making requests.
          </p>

          <TextInput
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              isBedrockProvider
                ? "Enter your AWS Access Key ID"
                : "Enter your API key"
            }
            label={isBedrockProvider ? "AWS Access Key ID" : "API Key"}
            description="Your credentials will be encrypted before being stored"
            required
            disabled={isStoringProviderApiKey}
          />

          {isBedrockProvider && (
            <TextInput
              type="password"
              autoComplete="off"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="Enter your AWS Secret Access Key"
              label="AWS Secret Access Key"
              required
              disabled={isStoringProviderApiKey}
            />
          )}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isStoringProviderApiKey}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !apiKey ||
                (isBedrockProvider && !secretKey) ||
                isStoringProviderApiKey
              }
              isLoading={isStoringProviderApiKey}
            >
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
