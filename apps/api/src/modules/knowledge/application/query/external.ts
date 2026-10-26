import {
  KNOWLEDGE_BASE_CONNECTOR_PROVIDERS,
  type KnowledgeBaseConnectorProvider,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createKnowledgeBaseProvider,
  type KnowledgeBaseHit,
} from "~/infrastructure/providers/capabilities/knowledge";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";
import { getRecipeConnectorAccessToken } from "~/modules/connectors/application";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { knowledgeConfigurationScope } from "~/modules/knowledge/application/enrichment/settings";

const logger = getLogger({ prefix: "knowledge/external" });
const EXTERNAL_CONCURRENCY = 3;

export const KNOWLEDGE_PROVIDER_CONFIGURATION_PREFIX = "provider:";

export interface ExternalKnowledgeHit extends KnowledgeBaseHit {
  provider: KnowledgeBaseConnectorProvider;
}

export interface ExternalKnowledgeResult {
  hits: ExternalKnowledgeHit[];
  outcomes: { provider: string; error: string | null }[];
}

export function isKnowledgeBaseProvider(value: string): value is KnowledgeBaseConnectorProvider {
  return KNOWLEDGE_BASE_CONNECTOR_PROVIDERS.some((provider) => provider === value);
}

export async function listConnectedKnowledgeProviders(
  context: Pick<ServiceContext, "repositories">,
  userId: number,
): Promise<KnowledgeBaseConnectorProvider[]> {
  const connections = await context.repositories
    .get(ProviderConnectionRepository)
    .listConnections(userId);

  return KNOWLEDGE_BASE_CONNECTOR_PROVIDERS.filter((provider) =>
    connections.some(
      (connection) => connection.provider === provider && connection.status === "connected",
    ),
  );
}

export async function listAttachedKnowledgeProviders(
  context: Pick<ServiceContext, "repositories">,
  projectId: string,
): Promise<{ provider: KnowledgeBaseConnectorProvider; ownerUserId: number }[]> {
  const records = await context.repositories
    .get(CapabilityConfigurationRepository)
    .list(knowledgeConfigurationScope({ userId: 0, projectId }), "knowledge");

  return records.flatMap((record) => {
    const provider = record.capabilityId.slice(KNOWLEDGE_PROVIDER_CONFIGURATION_PREFIX.length);
    const ownerUserId = record.configuration.ownerUserId;

    return record.capabilityId.startsWith(KNOWLEDGE_PROVIDER_CONFIGURATION_PREFIX) &&
      record.configuration.attached === true &&
      isKnowledgeBaseProvider(provider) &&
      typeof ownerUserId === "number"
      ? [{ provider, ownerUserId }]
      : [];
  });
}

async function resolveSearchers(
  context: ServiceContext,
  scope: { userId: number; projectId: string | null },
): Promise<{ provider: KnowledgeBaseConnectorProvider; ownerUserId: number }[]> {
  if (scope.projectId) {
    return listAttachedKnowledgeProviders(context, scope.projectId);
  }

  return (await listConnectedKnowledgeProviders(context, scope.userId)).map((provider) => ({
    provider,
    ownerUserId: scope.userId,
  }));
}

export async function searchExternalKnowledge(
  context: ServiceContext,
  scope: { userId: number; projectId: string | null },
  query: string,
  limit: number,
): Promise<ExternalKnowledgeResult> {
  const searchers = await resolveSearchers(context, scope);
  const results = await mapWithConcurrency(
    searchers,
    EXTERNAL_CONCURRENCY,
    async ({ provider, ownerUserId }) => {
      try {
        const credential = await getRecipeConnectorAccessToken({
          context,
          userId: ownerUserId,
          provider,
        });
        const hits = await createKnowledgeBaseProvider(provider, credential.accessToken).search(
          query,
          limit,
        );

        return { provider, hits: hits.map((hit) => ({ ...hit, provider })), error: null };
      } catch (error) {
        const message = getErrorMessage(error);

        logger.warn("An external knowledge base could not be searched", {
          provider,
          error_message: message,
        });

        return { provider, hits: [], error: message.slice(0, 200) };
      }
    },
  );

  return {
    hits: results.flatMap((result) => result.hits),
    outcomes: results.map(({ provider, error }) => ({ provider, error })),
  };
}
