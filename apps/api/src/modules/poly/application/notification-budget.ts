import {
  POLY_HANDOFF_CAPABILITY_ID,
  polyHandoffDataSchema,
  type PolyHandoffUrgency,
} from "@ngriffin_uk/polychat-schemas";
import { DAY_MS } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";
import {
  polyNotificationBudgetSchema,
  reservePolyNotification,
} from "~/modules/poly/domain/notification-budget";

export async function admitSharedPolyNotification(
  context: ServiceContext,
  input: {
    id: string;
    category: "routine" | "discover";
    urgency: PolyHandoffUrgency;
    polyConversationId: string;
    paused: boolean;
    discoverLimit?: number;
    now?: number;
  },
) {
  const repository = context.repositories.get(CapabilityConfigurationRepository);
  const key = {
    scope: { type: "user" as const, id: context.requireUser().id },
    capabilityKind: "recipe" as const,
    capabilityId: "poly.notification-budget",
  };
  const now = input.now ?? Date.now();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await repository.getVersioned(key);
    const bootstrap = current
      ? []
      : await context.repositories.get(ActivityRepository).listConversationActivitiesSince({
          conversationId: input.polyConversationId,
          capabilityId: POLY_HANDOFF_CAPABILITY_ID,
          since: new Date(now - DAY_MS).toISOString(),
          limit: 200,
        });
    const budget = current
      ? polyNotificationBudgetSchema.parse(current.configuration)
      : {
          entries: bootstrap.flatMap((entry) => {
            const parsed = polyHandoffDataSchema.safeParse(safeParseJson(entry.data));

            return parsed.success && parsed.data.decision === "notified"
              ? [{ id: entry.id, at: Date.parse(entry.created_at), category: "routine" as const }]
              : [];
          }),
        };
    const result = reservePolyNotification({ ...input, budget, now });

    if (!result.admission.admitted) {
      return result.admission;
    }

    if (budget.entries.some((entry) => entry.id === input.id)) {
      return result.admission;
    }

    if (
      await repository.saveVersioned({
        ...key,
        configuration: result.budget,
        expectedRevision: current?.revision ?? 0,
      })
    ) {
      return result.admission;
    }
  }

  throw new AssistantError("Notification budget is busy", ErrorType.CONFLICT_ERROR, 409);
}
