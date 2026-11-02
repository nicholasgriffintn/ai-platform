import type { PolyHandoffUrgency } from "@ngriffin_uk/polychat-schemas";
import { DAY_MS } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { admitPolyNotification, type NotificationAdmission } from "./budgets";

export const polyNotificationBudgetSchema = z.object({
  entries: z
    .array(z.object({ id: z.string(), at: z.number(), category: z.enum(["routine", "discover"]) }))
    .max(300),
});
export type PolyNotificationBudget = z.infer<typeof polyNotificationBudgetSchema>;

export function reservePolyNotification(input: {
  budget: PolyNotificationBudget;
  id: string;
  category: "routine" | "discover";
  urgency: PolyHandoffUrgency;
  now: number;
  paused: boolean;
  discoverLimit?: number;
}): { budget: PolyNotificationBudget; admission: NotificationAdmission } {
  const entries = input.budget.entries.filter(
    (entry) => input.now - entry.at < DAY_MS && entry.at <= input.now,
  );

  if (entries.some((entry) => entry.id === input.id)) {
    return { budget: { entries }, admission: { admitted: true, reason: "owner_must_act" } };
  }

  const admission =
    input.category === "discover" &&
    entries.filter((entry) => entry.category === "discover").length >= (input.discoverLimit ?? 0)
      ? { admitted: false, reason: "daily_cap" as const }
      : admitPolyNotification({
          urgency: input.urgency,
          notifiedAt: entries.map((entry) => entry.at),
          now: input.now,
          paused: input.paused,
        });

  return {
    admission,
    budget: {
      entries: admission.admitted
        ? [...entries, { id: input.id, at: input.now, category: input.category }]
        : entries,
    },
  };
}
