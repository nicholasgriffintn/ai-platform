import { Button, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type {
  RecipeTriggerConfigurationField,
  RecipeTriggerConfigurationValue,
} from "@ngriffin_uk/polychat-schemas";
import { AlertTriangle, Plus } from "lucide-react";

import { ConfigurationFields, type RecipeEventTriggerProvider } from "./RecipeEventTriggerViews";

export interface RecipeEventTriggerFormProps {
  providers: RecipeEventTriggerProvider[];
  providerId: string;
  onProviderIdChange: (providerId: string) => void;
  providerName?: string;
  accountOptions: Array<{ value: string; label: string }>;
  accountId: string;
  onAccountIdChange: (accountId: string) => void;
  hasActiveAccounts: boolean;
  triggerOptions: Array<{ value: string; label: string }>;
  triggerSlug: string;
  onTriggerSlugChange: (slug: string) => void;
  triggerDescription?: string;
  configurationFields: RecipeTriggerConfigurationField[];
  configurationValues: Record<string, RecipeTriggerConfigurationValue>;
  onConfigurationChange: (key: string, value: RecipeTriggerConfigurationValue) => void;
  hasUnsupportedRequiredFields?: boolean;
  validationError?: string | null;
  canCreate: boolean;
  isCreating?: boolean;
  onSubmit: () => void;
}

export function RecipeEventTriggerForm({
  providers,
  providerId,
  onProviderIdChange,
  accountOptions,
  accountId,
  onAccountIdChange,
  hasActiveAccounts,
  triggerOptions,
  triggerSlug,
  onTriggerSlugChange,
  triggerDescription,
  configurationFields,
  configurationValues,
  onConfigurationChange,
  hasUnsupportedRequiredFields = false,
  validationError,
  canCreate,
  isCreating = false,
  onSubmit,
}: RecipeEventTriggerFormProps) {
  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Add a live event</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Choose exactly which account and event can start this recipe.
        </p>
      </div>
      {providers.length > 1 && (
        <FormSelect
          label="Integration"
          value={providerId}
          onChange={(event) => onProviderIdChange(event.target.value)}
          options={providers.map((item) => ({ value: item.id, label: item.name }))}
        />
      )}
      <FormSelect
        label="Connected account"
        value={accountId}
        onChange={(event) => onAccountIdChange(event.target.value)}
        options={accountOptions}
        description={
          hasActiveAccounts
            ? "Only this account can start the recipe."
            : "Connect and name an account before adding an event."
        }
      />
      <FormSelect
        label="Event"
        value={triggerSlug}
        onChange={(event) => onTriggerSlugChange(event.target.value)}
        options={triggerOptions}
        description={triggerDescription ?? "No live events are available."}
      />
      <ConfigurationFields
        fields={configurationFields}
        values={configurationValues}
        onChange={onConfigurationChange}
      />
      {hasUnsupportedRequiredFields && (
        <p role="alert" className="flex gap-2 text-sm text-attention">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          This event requires advanced configuration that is not supported here yet.
        </p>
      )}
      {validationError && (
        <p role="alert" className="text-sm text-failure">
          {validationError}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        fullWidth
        icon={<Plus className="h-4 w-4" />}
        disabled={!canCreate}
        isLoading={isCreating}
      >
        Create event trigger
      </Button>
    </form>
  );
}
