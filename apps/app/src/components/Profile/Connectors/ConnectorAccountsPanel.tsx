import { ConnectorAccountsPanel as ControlledConnectorAccountsPanel } from "@ngriffin_uk/polychat-component-account";
import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import { useRecipeConnectorAccounts, useUpdateRecipeConnectorAccount } from "~/hooks/useConnectors";

export function ConnectorAccountsPanel({
  provider,
  providerName,
}: {
  provider: RecipeConnectorProvider;
  providerName: string;
}) {
  const accountsQuery = useRecipeConnectorAccounts(provider);
  const updateAccount = useUpdateRecipeConnectorAccount(provider);

  return (
    <ControlledConnectorAccountsPanel
      accounts={accountsQuery.data?.accounts ?? []}
      providerName={providerName}
      isLoading={accountsQuery.isLoading}
      hasLoadError={accountsQuery.isError}
      updatingAccountId={updateAccount.isPending ? updateAccount.variables?.accountId : null}
      hasUpdateError={updateAccount.isError}
      onRetry={() => void accountsQuery.refetch()}
      onRename={async (accountId, alias) => {
        await updateAccount.mutateAsync({ accountId, alias });
      }}
      onSelect={async (accountId) => {
        await updateAccount.mutateAsync({ accountId, selected: true });
      }}
    />
  );
}
