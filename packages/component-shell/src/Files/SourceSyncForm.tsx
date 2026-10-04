import { FormDialog, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  useRecipeConnectors,
  useRecipeConnectorAccounts,
  useSourceSyncMutations,
} from "@ngriffin_uk/polychat-library-react";
import type { RecipeConnectorManifest } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";
import { toast } from "sonner";

function SourceSyncAccountSelect({
  provider,
  value,
  onChange,
}: {
  provider: RecipeConnectorManifest;
  value: string;
  onChange: (value: string) => void;
}) {
  const accounts = useRecipeConnectorAccounts(provider.id);
  const activeAccounts = (accounts.data?.accounts ?? []).filter(
    (account) => account.status === "ACTIVE" && !account.isDisabled,
  );

  return (
    <>
      <FormSelect
        label="Connected account"
        value={value}
        onValueChange={onChange}
        options={activeAccounts.map((account) => ({
          value: account.id,
          label: account.alias ?? `${provider.name} account`,
        }))}
      />
      {accounts.error ? (
        <p role="alert" className="text-sm text-destructive">
          {accounts.error.message}
        </p>
      ) : null}
      {!accounts.isLoading && !activeAccounts.length ? (
        <p className="text-sm text-muted-foreground">Connect {provider.name} in Plugins first.</p>
      ) : null}
    </>
  );
}

export function SourceSyncForm({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}) {
  const connectors = useRecipeConnectors({ enabled: open });
  const mutations = useSourceSyncMutations();
  const [providerId, setProviderId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [rootId, setRootId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const providers = (connectors.data?.connectors ?? []).filter((provider) => provider.knowledge);
  const provider = providers.find((candidate) => candidate.id === providerId);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sync a knowledge source"
      submitText="Start syncing"
      isLoading={mutations.create.isPending}
      onSubmit={async () => {
        if (
          !provider?.knowledge ||
          !rootId.trim() ||
          !title.trim() ||
          (provider.authType === "composio" && !accountId)
        ) {
          setError("Choose a provider and connection, name the source and enter its location.");

          return;
        }

        try {
          await mutations.create.mutateAsync({
            projectId,
            provider: provider.id,
            accountId: accountId || undefined,
            rootId,
            title,
          });
          onOpenChange(false);
          setTitle("");
          setRootId("");
          setError(null);
          toast.success("Knowledge sync added");
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : "Could not add this source.");
        }
      }}
    >
      <div className="space-y-4">
        <FormSelect
          label="Provider"
          value={providerId}
          options={providers.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          onValueChange={(value) => {
            setProviderId(value);
            setAccountId("");
            setRootId("");
            setError(null);
          }}
        />
        {connectors.error ? (
          <p role="alert" className="text-sm text-destructive">
            {connectors.error.message}
          </p>
        ) : null}
        {provider?.knowledge ? (
          <>
            {provider.authType === "composio" ? (
              <SourceSyncAccountSelect
                key={provider.id}
                provider={provider}
                value={accountId}
                onChange={setAccountId}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {provider.status === "connected"
                  ? `Use your connected ${provider.name} credentials.`
                  : `Connect ${provider.name} in Plugins first.`}
              </p>
            )}
            <FormInput
              label="Source name"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
            <FormInput
              label={provider.knowledge.rootLabel}
              placeholder={provider.knowledge.rootPlaceholder}
              value={rootId}
              onChange={(event) => setRootId(event.target.value)}
              maxLength={4096}
            />
            <p className="text-xs text-muted-foreground">
              {provider.knowledge.contentDescription}
              {projectId
                ? " A document appears in this project only when verified upstream permissions cover every current workspace member."
                : " Sources stay in your personal knowledge."}
            </p>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
