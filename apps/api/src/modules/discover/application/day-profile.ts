import {
  discoverDayProfileContentSchema,
  DISCOVER_DAY_CONFIGURATION_ID,
  type DiscoverDayProfile,
  type UpdateDiscoverDayProfile,
} from "@ngriffin_uk/polychat-schemas";
import { describeZonedInstant, shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";
import { applyDiscoverDayUpdate } from "~/modules/discover/domain/day";
import { NotificationRepository } from "~/modules/notifications/infrastructure/NotificationRepository";

import { publishDiscoverChanged } from "./events";

export async function readDiscoverDayProfile(context: ServiceContext): Promise<DiscoverDayProfile> {
  const record = await context.repositories.get(CapabilityConfigurationRepository).getVersioned({
    scope: { type: "user", id: context.requireUser().id },
    capabilityKind: "recipe",
    capabilityId: DISCOVER_DAY_CONFIGURATION_ID,
  });

  return record
    ? {
        ...discoverDayProfileContentSchema.parse(record.configuration),
        revision: record.revision,
        updatedAt: record.updatedAt,
      }
    : { ...discoverDayProfileContentSchema.parse({}), revision: 0, updatedAt: null };
}

export async function saveDiscoverDayProfile(
  context: ServiceContext,
  input: UpdateDiscoverDayProfile,
  now = new Date(),
): Promise<DiscoverDayProfile> {
  const user = context.requireUser();
  const current = await readDiscoverDayProfile(context);
  const { revision, updatedAt: _updatedAt, ...content } = current;
  const today = describeZonedInstant(now, input.timezone ?? current.timezone).date;

  if (
    input.override &&
    (input.override.date < today || input.override.date > shiftCalendarDate(today, 366))
  ) {
    throw new AssistantError("Choose a day within the next year", ErrorType.PARAMS_ERROR, 400);
  }

  if (revision !== input.expectedRevision) {
    throw new AssistantError(
      "Your day changed on another device. Reload it and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const updated = applyDiscoverDayUpdate(content, input, now);
  const saved = await context.repositories.get(CapabilityConfigurationRepository).saveVersioned({
    scope: { type: "user", id: user.id },
    capabilityKind: "recipe",
    capabilityId: DISCOVER_DAY_CONFIGURATION_ID,
    configuration: updated,
    expectedRevision: input.expectedRevision,
  });

  if (!saved) {
    throw new AssistantError(
      "Your day changed on another device. Reload it and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await context.repositories.get(NotificationRepository).cancelSource(user.id, "discover");
  await publishDiscoverChanged(context);

  return { ...updated, revision: input.expectedRevision + 1, updatedAt: now.toISOString() };
}
