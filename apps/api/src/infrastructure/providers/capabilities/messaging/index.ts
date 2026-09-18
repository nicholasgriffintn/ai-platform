import { ensureConfig } from "../../registry/registrations/utils";
import type { ProviderFactoryContext } from "../../registry/types";
import type { MessagingProviderCredentials } from "./types";

export * from "./credentials";
export * from "./metadata";
export * from "./providers";
export * from "./senders";
export { MESSAGING_PROVIDER_IDS } from "./types";
export type * from "./types";

export function ensureMessagingCredentials(context: ProviderFactoryContext) {
  return ensureConfig<MessagingProviderCredentials>(
    context,
    "Messaging provider resolution requires credentials",
  );
}
