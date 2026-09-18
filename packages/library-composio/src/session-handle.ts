export const COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN = "^ccs_[A-Za-z0-9-]+$";

const COMPOSIO_CONNECTOR_SESSION_HANDLE = new RegExp(COMPOSIO_CONNECTOR_SESSION_HANDLE_PATTERN);

export function isComposioConnectorSessionHandle(value: unknown): value is string {
  return typeof value === "string" && COMPOSIO_CONNECTOR_SESSION_HANDLE.test(value);
}
