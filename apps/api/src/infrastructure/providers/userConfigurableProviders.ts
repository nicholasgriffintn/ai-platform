import {
  listChatProviders,
  listConfigurableChatProviders,
} from "~/infrastructure/providers/capabilities/chat";
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
  type: "chat" | "messaging" | "decision" | "embedding";
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

function isChatProviderId(providerId: string): boolean {
  return listChatProviders().includes(providerId);
}

export function listConfigurableUserProviderIds(): string[] {
  return Array.from(
    new Set([
      "dynamodb-vectors",
      ...listConfigurableChatProviders(),
      ...listConfigurableDecisionProviders().filter((providerId) => !isChatProviderId(providerId)),
      ...listConfigurableMessagingProviders(),
    ]),
  ).sort();
}

export function getUserConfigurableProviderMetadata(providerId: string): UserConfigurableProvider {
  if (providerId === "dynamodb-vectors") {
    return {
      id: providerId,
      name: "DynamoDB Vectors",
      type: "embedding",
      description: "Store document and memory vectors in Amazon DynamoDB.",
    };
  }

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

  const decisionVendor = isChatProviderId(providerId)
    ? undefined
    : getDecisionProviderVendor(providerId);

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
