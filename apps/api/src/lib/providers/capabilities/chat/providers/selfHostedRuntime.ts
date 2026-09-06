import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";

import { AssistantError, ErrorType } from "~/utils/errors";

export function requireSelfHostedRuntimeUrl(
  configured: string | undefined,
  provider: string,
): string {
  if (!configured) {
    throw new AssistantError(
      `${provider} needs an explicit URL this deployment can reach. Set it, or use the desktop application for a runtime on your own machine.`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  let url: URL;

  try {
    url = new URL(configured.trim());
  } catch {
    throw new AssistantError(
      `${provider} is configured with an address that cannot be read.`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AssistantError(
      `${provider} must be configured over HTTP or HTTPS.`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (isPrivateHostname(url.hostname)) {
    throw new AssistantError(
      `${provider} is configured on an address inside this deployment's own network, which it must not reach. Use the desktop application for a runtime on your own machine.`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
