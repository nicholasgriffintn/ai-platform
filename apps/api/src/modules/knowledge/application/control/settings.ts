import {
  getConnectorProviderConfig,
  KNOWLEDGE_BASE_CONNECTOR_PROVIDERS,
} from "@ngriffin_uk/polychat-ai-integrations";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { KnowledgeSettings, UpdateKnowledgeSettings } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";
import {
  knowledgeConfigurationScope,
  readKnowledgeEnricherSettings,
  saveKnowledgeEnricherSettings,
} from "~/modules/knowledge/application/enrichment/settings";
import {
  isKnowledgeBaseProvider,
  KNOWLEDGE_PROVIDER_CONFIGURATION_PREFIX,
  listAttachedKnowledgeProviders,
  listConnectedKnowledgeProviders,
} from "~/modules/knowledge/application/query/external";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

interface SettingsScope {
  userId: number;
  projectId: string | null;
  role: string | null;
}

async function resolveScope(context: ServiceContext, projectId?: string): Promise<SettingsScope> {
  const userId = context.requireUser().id;

  if (!projectId) {
    return { userId, projectId: null, role: null };
  }

  const { role } = await requireProjectAccess(context, projectId);

  return { userId, projectId, role };
}

function canConfigure(scope: SettingsScope): boolean {
  return authorise("knowledge.configure", {
    actorId: String(scope.userId),
    ownerId: String(scope.userId),
    scope: scope.projectId ? "project" : "personal",
    member: scope.role !== null,
    role: scope.role ?? "",
  }).allowed;
}

export async function getKnowledgeSettings(
  context: ServiceContext,
  projectId?: string,
): Promise<KnowledgeSettings> {
  const scope = await resolveScope(context, projectId);
  const [enrichers, connected, attached] = await Promise.all([
    readKnowledgeEnricherSettings(context, scope),
    listConnectedKnowledgeProviders(context, scope.userId),
    scope.projectId
      ? listAttachedKnowledgeProviders(context, scope.projectId)
      : Promise.resolve([]),
  ]);

  return {
    projectId: scope.projectId,
    enrichers,
    providers: KNOWLEDGE_BASE_CONNECTOR_PROVIDERS.map((provider) => ({
      provider,
      name: getConnectorProviderConfig(provider)?.name ?? provider,
      connected: connected.includes(provider),
      attached: scope.projectId
        ? attached.some((entry) => entry.provider === provider)
        : connected.includes(provider),
    })),
    canManage: canConfigure(scope),
  };
}

export async function updateKnowledgeSettings(
  context: ServiceContext,
  input: UpdateKnowledgeSettings,
): Promise<KnowledgeSettings> {
  const scope = await resolveScope(context, input.project_id);

  if (!canConfigure(scope)) {
    throw new AssistantError(
      "Only a project owner or admin can change its knowledge settings",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (input.enrichers) {
    await saveKnowledgeEnricherSettings(context, scope, input.enrichers);
  }

  if (input.providers?.length) {
    if (!scope.projectId) {
      throw new AssistantError(
        "Connected knowledge bases are already searched in your own library",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const connected = await listConnectedKnowledgeProviders(context, scope.userId);

    for (const entry of input.providers) {
      if (!isKnowledgeBaseProvider(entry.provider)) {
        throw new AssistantError("Unknown knowledge base", ErrorType.PARAMS_ERROR, 400);
      }

      if (
        entry.attached &&
        !authorise("knowledge.attach", {
          connected: connected.includes(entry.provider),
          member: scope.role !== null,
          role: scope.role ?? "",
        }).allowed
      ) {
        throw new AssistantError(
          "Connect this knowledge base yourself before attaching it to the project",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      await context.repositories.get(CapabilityConfigurationRepository).save({
        scope: knowledgeConfigurationScope(scope),
        capabilityKind: "knowledge",
        capabilityId: `${KNOWLEDGE_PROVIDER_CONFIGURATION_PREFIX}${entry.provider}`,
        configuration: { attached: entry.attached, ownerUserId: scope.userId },
      });
    }
  }

  return getKnowledgeSettings(context, scope.projectId ?? undefined);
}
