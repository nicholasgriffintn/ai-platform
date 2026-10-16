import {
  listPageOf,
  modelToolIdSchema,
  type ListPage,
  type ModelToolId,
  type SavedToolConfiguration,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { CapabilityConfigurationScope } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";

import { validateModelToolConfiguration } from "./modelToolConfiguration";

export async function listModelToolConfigurations(
  context: ServiceContext,
  scope: CapabilityConfigurationScope,
): Promise<ListPage<SavedToolConfiguration>> {
  const records = await context.repositories
    .get(CapabilityConfigurationRepository)
    .list(scope, "tool");

  return listPageOf(
    records.flatMap((record) => {
      const toolId = modelToolIdSchema.safeParse(record.capabilityId);

      return toolId.success
        ? [
            {
              toolId: toolId.data,
              configuration: record.configuration,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
            },
          ]
        : [];
    }),
    (configuration) => configuration.toolId,
  );
}

export async function saveModelToolConfiguration(
  context: ServiceContext,
  scope: CapabilityConfigurationScope,
  toolId: ModelToolId,
  configuration: Record<string, unknown>,
): Promise<SavedToolConfiguration> {
  const validated = validateModelToolConfiguration(toolId, configuration);
  const record = await context.repositories.get(CapabilityConfigurationRepository).save({
    scope,
    capabilityKind: "tool",
    capabilityId: toolId,
    configuration: validated,
  });

  return {
    toolId,
    configuration: record.configuration,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
