import {
  type RecipeEventTriggerProvider,
  RecipeEventTriggerForm,
  TriggerList,
} from "@ngriffin_uk/polychat-component-capabilities";
import {
  Button,
  ConfirmationDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import {
  type AssistantRecipe,
  type RecipeComposioTrigger,
  type RecipeConnectorAccount,
  type RecipeInstallation,
  buildRecipeTriggerConfiguration,
  getRecipeTriggerConfigurationFields,
  type RecipeTriggerConfigurationValue,
} from "@ngriffin_uk/polychat-schemas";
import { useEffect, useMemo, useState } from "react";

import { useRecipeConnectorAccounts } from "~/hooks/useConnectors";
import { getErrorMessage } from "~/lib/errors";

import { useRecipeComposioTriggers } from "./useRecipeComposioTriggers";

interface RecipeEventTriggersDialogProps {
  recipe: AssistantRecipe;
  installation: RecipeInstallation;
  providers: RecipeEventTriggerProvider[];
  onClose: () => void;
}

function getAccountOptions(accounts: RecipeConnectorAccount[], providerName: string) {
  return accounts.map((account, index) => ({
    value: account.id,
    label: account.alias?.trim() || `${providerName} account ${index + 1}`,
  }));
}

export function RecipeEventTriggersDialog({
  recipe,
  installation,
  providers,
  onClose,
}: RecipeEventTriggersDialogProps) {
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "github");
  const [accountId, setAccountId] = useState("");
  const [triggerSlug, setTriggerSlug] = useState("");
  const [configurationValues, setConfigurationValues] = useState<
    Record<string, RecipeTriggerConfigurationValue>
  >({});
  const [validationError, setValidationError] = useState<string>();
  const [triggerToDelete, setTriggerToDelete] = useState<RecipeComposioTrigger | null>(null);
  const provider = providers.find((candidate) => candidate.id === providerId) ?? providers[0];
  const accountsQuery = useRecipeConnectorAccounts(providerId);
  const manager = useRecipeComposioTriggers(installation.id, providerId);
  const activeAccounts = useMemo(
    () =>
      (accountsQuery.data?.accounts ?? []).filter(
        (account) => account.status === "ACTIVE" && !account.isDisabled,
      ),
    [accountsQuery.data?.accounts],
  );
  const triggerTypes = manager.triggerTypes.data?.triggerTypes ?? [];
  const selectedTriggerType = triggerTypes.find((type) => type.slug === triggerSlug);
  const configuration = getRecipeTriggerConfigurationFields(
    selectedTriggerType?.configuration ?? {},
  );

  useEffect(() => {
    const selected = activeAccounts.find((account) => account.isSelected) ?? activeAccounts[0];

    setAccountId(selected?.id ?? "");
  }, [activeAccounts]);

  useEffect(() => {
    setTriggerSlug(triggerTypes[0]?.slug ?? "");
  }, [triggerTypes]);

  useEffect(() => {
    setConfigurationValues(
      Object.fromEntries(configuration.fields.map((field) => [field.key, field.defaultValue])),
    );
    setValidationError(undefined);
  }, [triggerSlug]);

  const submit = async () => {
    if (!provider || !accountId || !selectedTriggerType) {
      return;
    }

    if (configuration.unsupportedRequiredLabels.length > 0) {
      setValidationError("This event needs configuration that is not supported here yet.");

      return;
    }

    const result = buildRecipeTriggerConfiguration(configuration.fields, configurationValues);

    if (result.error) {
      setValidationError(result.error);

      return;
    }

    setValidationError(undefined);
    await manager.createTrigger.mutateAsync({
      providerId: provider.id,
      connectedAccountId: accountId,
      triggerSlug: selectedTriggerType.slug,
      configuration: result.configuration,
    });
  };

  const requestError =
    accountsQuery.error ??
    manager.triggerTypes.error ??
    manager.triggers.error ??
    manager.createTrigger.error ??
    manager.updateTrigger.error ??
    manager.deleteTrigger.error;
  const isLoading =
    accountsQuery.isLoading || manager.triggerTypes.isLoading || manager.triggers.isLoading;
  const canCreate =
    Boolean(provider && accountId && selectedTriggerType) &&
    configuration.unsupportedRequiredLabels.length === 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Event triggers for {recipe.title}</DialogTitle>
          <DialogDescription>
            Run this installed recipe when a selected connected app reports an event.
          </DialogDescription>
        </DialogHeader>

        {requestError && (
          <div
            role="alert"
            className="rounded-md border border-failure/45 bg-failure/12 p-3 text-sm text-failure"
          >
            {getErrorMessage(requestError, "Could not load or update event triggers.")}
          </div>
        )}

        {isLoading ? (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">
            Loading event options…
          </p>
        ) : (
          <div className="grid gap-6 py-2 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <RecipeEventTriggerForm
              providers={providers}
              providerId={providerId}
              onProviderIdChange={setProviderId}
              accountOptions={getAccountOptions(activeAccounts, provider?.name ?? "Connected")}
              accountId={accountId}
              onAccountIdChange={setAccountId}
              hasActiveAccounts={activeAccounts.length > 0}
              triggerOptions={triggerTypes.map((type) => ({ value: type.slug, label: type.name }))}
              triggerSlug={triggerSlug}
              onTriggerSlugChange={setTriggerSlug}
              triggerDescription={selectedTriggerType?.description}
              configurationFields={configuration.fields}
              configurationValues={configurationValues}
              onConfigurationChange={(key, value) =>
                setConfigurationValues((current) => ({ ...current, [key]: value }))
              }
              hasUnsupportedRequiredFields={configuration.unsupportedRequiredLabels.length > 0}
              validationError={validationError}
              canCreate={canCreate}
              isCreating={manager.createTrigger.isPending}
              onSubmit={() => {
                void submit().catch(() => undefined);
              }}
            />

            <section aria-labelledby="active-event-triggers" className="space-y-3">
              <div>
                <h3 id="active-event-triggers" className="text-sm font-semibold text-foreground">
                  Installed events
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pause an event without removing its setup.
                </p>
              </div>
              <TriggerList
                triggers={manager.triggers.data?.triggers ?? []}
                triggerTypes={triggerTypes}
                providers={providers}
                onSetStatus={(trigger, status) =>
                  manager.updateTrigger.mutate({ triggerId: trigger.id, status })
                }
                onDelete={setTriggerToDelete}
                isUpdating={(trigger) =>
                  manager.updateTrigger.isPending &&
                  manager.updateTrigger.variables?.triggerId === trigger.id
                }
                isDeleting={(trigger) =>
                  manager.deleteTrigger.isPending && manager.deleteTrigger.variables === trigger.id
                }
              />
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
        <ConfirmationDialog
          open={triggerToDelete !== null}
          onOpenChange={(open) => !open && setTriggerToDelete(null)}
          title="Delete event trigger?"
          description="This stops the connected app event from starting this recipe. This cannot be undone."
          confirmText="Delete trigger"
          variant="destructive"
          isLoading={manager.deleteTrigger.isPending}
          onConfirm={async () => {
            if (!triggerToDelete) {
              return;
            }

            await manager.deleteTrigger.mutateAsync(triggerToDelete.id);
            setTriggerToDelete(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
