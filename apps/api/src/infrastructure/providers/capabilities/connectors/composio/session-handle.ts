export const COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN = "^ccs_[A-Za-z0-9-]+$";

const composioConnectorSessionHandleRegex = new RegExp(COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN);

export function isComposioConnectorSessionHandle(value: unknown): value is string {
  return typeof value === "string" && composioConnectorSessionHandleRegex.test(value);
}
