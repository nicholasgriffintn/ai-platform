import { usageLimitsSchema } from "@ngriffin_uk/polychat-schemas";

import type { UsageLimits } from "~/state/stores/usageStore";

export function normaliseUsageLimits(value: unknown): UsageLimits | null {
  const parsed = usageLimitsSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}
