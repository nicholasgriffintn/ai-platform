import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ApiKeyConnectorConfig } from "./providers.js";

export function joinConnectorCredential(
  auth: ApiKeyConnectorConfig,
  credentials: readonly string[],
): string {
  const parts = credentials.map((part) => part.trim());

  if (parts.length !== auth.credentialFields.length || parts.some((part) => !part)) {
    throw new AssistantError(
      `Enter ${auth.credentialFields.map((field) => field.label.toLowerCase()).join(" and ")}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const separator = auth.credentialSeparator ?? "";

  if (parts.length > 1 && !separator) {
    throw new AssistantError(
      "Connector credential format is not configured",
      ErrorType.CONFIGURATION_ERROR,
      500,
    );
  }

  if (separator && parts.some((part) => part.includes(separator))) {
    throw new AssistantError(
      `Connector credentials cannot contain "${separator}"`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return parts.join(separator);
}
