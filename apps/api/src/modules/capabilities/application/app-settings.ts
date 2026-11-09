import type { AppSettingsResponse } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { isKnownAppId } from "~/modules/capabilities/domain/app-catalogue";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";

export async function readTurnedOffAppIds(context: ServiceContext): Promise<Set<string>> {
  const records = await context.repositories
    .get(CapabilityConfigurationRepository)
    .list({ type: "user", id: context.requireUser().id }, "app");

  return new Set(
    records
      .filter(
        (record) => isKnownAppId(record.capabilityId) && record.configuration.enabled === false,
      )
      .map((record) => record.capabilityId),
  );
}

export async function setAppEnabled(
  context: ServiceContext,
  appId: string,
  enabled: boolean,
): Promise<AppSettingsResponse> {
  if (!isKnownAppId(appId)) {
    throw new AssistantError("Unknown app", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.get(CapabilityConfigurationRepository).save({
    scope: { type: "user", id: context.requireUser().id },
    capabilityKind: "app",
    capabilityId: appId,
    configuration: { enabled },
  });

  return { id: appId, enabled };
}
