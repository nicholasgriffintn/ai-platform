export const RECIPE_CONNECTOR_CONNECTION_KIND = "recipe_connector";
export const CONNECTOR_ACCOUNT_REFERENCE_KIND = "recipe_connector_account";

export type ConnectorConnectionAuthType = "api_key" | "composio";

export function isGrantableConnectorConnectionKind(kind: string): boolean {
  return kind === RECIPE_CONNECTOR_CONNECTION_KIND || kind === CONNECTOR_ACCOUNT_REFERENCE_KIND;
}

export function isConnectorConnectionKindForAuth(
  kind: string,
  authType: ConnectorConnectionAuthType,
): boolean {
  return authType === "composio"
    ? kind === CONNECTOR_ACCOUNT_REFERENCE_KIND
    : kind === RECIPE_CONNECTOR_CONNECTION_KIND;
}
