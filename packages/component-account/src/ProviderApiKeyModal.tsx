import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
} from "@ngriffin_uk/polychat-component-ui";
import { useEffect, useState } from "react";

export interface ProviderCredentialsInput {
  apiKey: string;
  secretKey?: string;
  configuration?: Record<string, string>;
}

export interface ProviderApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  providerName: string;
  configurationFields?: Array<{
    key: string;
    label: string;
    type: "text" | "password";
    required?: boolean;
    placeholder?: string;
    description?: string;
  }>;
  configurationValues?: Record<string, string>;
  hasStoredCredentials?: boolean;
  webhookUrl?: string;
  onDelete?: () => void;
  isDeleting?: boolean;
  isSubmitting?: boolean;
  onSubmit: (credentials: ProviderCredentialsInput) => Promise<void>;
}

const EMPTY_CONFIGURATION_VALUES: Record<string, string> = {};

export function ProviderApiKeyModal({
  open,
  onOpenChange,
  providerId,
  providerName,
  configurationFields = [],
  configurationValues: initialConfigurationValues = EMPTY_CONFIGURATION_VALUES,
  hasStoredCredentials = false,
  webhookUrl,
  onDelete,
  isDeleting = false,
  isSubmitting = false,
  onSubmit,
}: ProviderApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [configurationValues, setConfigurationValues] = useState<Record<string, string>>({});

  const isBedrockProvider =
    providerName.toLowerCase() === "polly" || providerName.toLowerCase() === "bedrock";
  const usesConfigurationFields = configurationFields.length > 0;
  const requiresSecretKey = isBedrockProvider;

  useEffect(() => {
    if (open) {
      setApiKey("");
      setSecretKey("");
      setConfigurationValues(initialConfigurationValues);

      return;
    }

    if (!open) {
      setApiKey("");
      setSecretKey("");
      setConfigurationValues({});
    }
  }, [initialConfigurationValues, open]);

  const updateConfigurationValue = (key: string, value: string) => {
    setConfigurationValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const hasMissingRequiredConfiguration = configurationFields.some(
    (field) =>
      field.required &&
      !(hasStoredCredentials && field.type === "password") &&
      !configurationValues[field.key]?.trim(),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const providerApiKey = usesConfigurationFields
      ? configurationValues.accountSid ||
        configurationValues.accessKeyId ||
        configurationValues.apiKey ||
        ""
      : apiKey;
    const providerSecretKey = usesConfigurationFields
      ? configurationValues.authToken || configurationValues.secretAccessKey || undefined
      : isBedrockProvider
        ? secretKey
        : undefined;
    const configuration = usesConfigurationFields ? configurationValues : undefined;

    try {
      await onSubmit({
        apiKey: providerApiKey,
        secretKey: providerSecretKey,
        configuration,
      });
      setApiKey("");
      setSecretKey("");
      setConfigurationValues({});
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
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {usesConfigurationFields
              ? `Enter the required connection details for ${providerName}.`
              : isBedrockProvider
                ? `Enter your AWS Access Key ID and Secret Access Key for ${providerName}.`
                : `Enter your API key for ${providerName}.`}
            This will be securely stored and used for making requests.
          </p>

          {usesConfigurationFields ? (
            configurationFields.map((field) => (
              <FormInput
                key={field.key}
                id={`provider-${providerId}-${field.key}`}
                type={field.type}
                autoComplete="off"
                value={configurationValues[field.key] ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateConfigurationValue(field.key, e.target.value)
                }
                placeholder={field.placeholder}
                label={field.label}
                description={
                  hasStoredCredentials && field.type === "password"
                    ? `${field.description ?? "This secret is already stored."} Leave blank to keep the saved value.`
                    : field.description
                }
                required={field.required && !(hasStoredCredentials && field.type === "password")}
                disabled={isSubmitting}
              />
            ))
          ) : (
            <FormInput
              id={`provider-${providerId}-api-key`}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
              placeholder={
                isBedrockProvider ? "Enter your AWS Access Key ID" : "Enter your API key"
              }
              label={isBedrockProvider ? "AWS Access Key ID" : "API Key"}
              description="Your credentials will be encrypted before being stored"
              required
              disabled={isSubmitting}
            />
          )}

          {!usesConfigurationFields && requiresSecretKey && (
            <FormInput
              id={`provider-${providerId}-secret-key`}
              type="password"
              autoComplete="off"
              value={secretKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSecretKey(e.target.value)}
              placeholder="Enter your AWS Secret Access Key"
              label="AWS Secret Access Key"
              required
              disabled={isSubmitting}
            />
          )}

          {webhookUrl && (
            <FormInput
              id={`provider-${providerId}-webhook-url`}
              type="text"
              value={webhookUrl}
              label="Webhook URL"
              description="Use this as the inbound message webhook URL in your provider dashboard."
              readOnly
            />
          )}

          <DialogFooter>
            {hasStoredCredentials && onDelete && (
              <Button
                type="button"
                variant="ghost"
                className="text-failure hover:bg-failure/12 hover:text-failure"
                onClick={onDelete}
                disabled={isSubmitting || isDeleting}
                isLoading={isDeleting}
              >
                Remove key
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                usesConfigurationFields
                  ? hasMissingRequiredConfiguration || isSubmitting
                  : !apiKey || (isBedrockProvider && !secretKey) || isSubmitting
              }
              isLoading={isSubmitting}
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
