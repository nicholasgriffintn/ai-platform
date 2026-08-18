import type { RecipeConnectorAccount } from "@ngriffin_uk/polychat-schemas";

export function getConnectorAccountLabel(
  account: RecipeConnectorAccount,
  providerName: string,
  index: number,
): string {
  return account.alias?.trim() || `${providerName} account ${index + 1}`;
}

export function isConnectorAccountSelectable(account: RecipeConnectorAccount): boolean {
  return account.status.toUpperCase() === "ACTIVE" && !account.isDisabled;
}
