import type { PolyHandoffUrgency } from "@ngriffin_uk/polychat-schemas";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const POLY_NOTIFICATION_BUDGET = {
  perDay: 5,
  spacingMs: 30 * MINUTE_MS,
} as const;

export interface NotificationAdmission {
  admitted: boolean;
  reason: "owner_must_act" | "not_urgent" | "daily_cap" | "spacing";
}

export function admitPolyNotification(params: {
  urgency: PolyHandoffUrgency;
  notifiedAt: readonly number[];
  now: number;
}): NotificationAdmission {
  if (params.urgency !== "critical" && params.urgency !== "high") {
    return { admitted: false, reason: "not_urgent" };
  }

  const today = params.notifiedAt.filter((at) => params.now - at < DAY_MS);

  if (today.length >= POLY_NOTIFICATION_BUDGET.perDay) {
    return { admitted: false, reason: "daily_cap" };
  }

  const latest = today.length > 0 ? Math.max(...today) : null;

  if (
    params.urgency !== "critical" &&
    latest !== null &&
    params.now - latest < POLY_NOTIFICATION_BUDGET.spacingMs
  ) {
    return { admitted: false, reason: "spacing" };
  }

  return { admitted: true, reason: "owner_must_act" };
}
