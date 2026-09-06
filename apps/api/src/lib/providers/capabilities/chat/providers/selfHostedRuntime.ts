import { isLoopbackUrl } from "@ngriffin_uk/polychat-schemas";

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

  if (isLoopbackUrl(configured)) {
    throw new AssistantError(
      `${provider} is configured on a loopback address, which this deployment cannot reach. Use the desktop application for a runtime on your own machine.`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return configured.replace(/\/+$/, "");
}
