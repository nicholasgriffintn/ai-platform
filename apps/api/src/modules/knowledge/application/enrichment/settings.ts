import {
  knowledgeEnricherSettingsSchema,
  type KnowledgeEnricherSettings,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  CapabilityConfigurationRepository,
  type CapabilityConfigurationScope,
} from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";

const ENRICHERS_CONFIGURATION_ID = "enrichers";

export function knowledgeConfigurationScope(scope: {
  userId: number;
  projectId: string | null;
}): CapabilityConfigurationScope {
  return scope.projectId
    ? { type: "project", id: scope.projectId }
    : { type: "user", id: scope.userId };
}

export async function readKnowledgeEnricherSettings(
  context: Pick<ServiceContext, "repositories">,
  scope: { userId: number; projectId: string | null },
): Promise<KnowledgeEnricherSettings> {
  const records = await context.repositories
    .get(CapabilityConfigurationRepository)
    .list(knowledgeConfigurationScope(scope), "knowledge");
  const record = records.find((entry) => entry.capabilityId === ENRICHERS_CONFIGURATION_ID);
  const parsed = knowledgeEnricherSettingsSchema.safeParse(record?.configuration ?? {});

  return parsed.success ? parsed.data : knowledgeEnricherSettingsSchema.parse({});
}

export async function saveKnowledgeEnricherSettings(
  context: Pick<ServiceContext, "repositories">,
  scope: { userId: number; projectId: string | null },
  settings: KnowledgeEnricherSettings,
): Promise<KnowledgeEnricherSettings> {
  const record = await context.repositories.get(CapabilityConfigurationRepository).save({
    scope: knowledgeConfigurationScope(scope),
    capabilityKind: "knowledge",
    capabilityId: ENRICHERS_CONFIGURATION_ID,
    configuration: knowledgeEnricherSettingsSchema.parse(settings),
  });

  return knowledgeEnricherSettingsSchema.parse(record.configuration);
}
