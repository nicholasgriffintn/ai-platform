import { listConfigurableChatProviders } from "~/infrastructure/providers/capabilities/chat";
import {
  getDecisionProviderVendor,
  listConfigurableDecisionProviders,
} from "~/infrastructure/providers/capabilities/decision";
import {
  getMessagingProviderMetadata,
  isMessagingProviderId,
  listConfigurableMessagingProviders,
} from "~/infrastructure/providers/capabilities/messaging";

export interface UserConfigurableProvider {
  id: string;
  name: string;
  type: "chat" | "messaging" | "decision";
  description?: string;
  configurationFields?: Array<{
    key: string;
    label: string;
    type: "text" | "password";
    required?: boolean;
    placeholder?: string;
    description?: string;
  }>;
}

export function listConfigurableUserProviderIds(): string[] {
  return Array.from(
    new Set([
      ...listConfigurableChatProviders(),
      ...listConfigurableDecisionProviders(),
      ...listConfigurableMessagingProviders(),
    ]),
  ).sort();
}

export function getUserConfigurableProviderMetadata(providerId: string): UserConfigurableProvider {
  if (isMessagingProviderId(providerId)) {
    const metadata = getMessagingProviderMetadata(providerId);

    if (metadata) {
      return {
        id: metadata.id,
        name: metadata.name,
        type: "messaging",
        description: metadata.description,
        configurationFields: metadata.configurationFields,
      };
    }
  }

  const decisionVendor = getDecisionProviderVendor(providerId);

  if (decisionVendor) {
    return {
      id: providerId,
      name: decisionVendor,
      type: "decision",
      description:
        "Jev, a System One decision model. Calibrated yes/no, choice and score answers for guardrails, memory gating and the decide tool.",
    };
  }

  return {
    id: providerId,
    name: providerId,
    type: "chat",
  };
}
