import { buildAnalyticsDistinctId as buildSharedAnalyticsDistinctId } from "@ngriffin_uk/polychat-schemas";

import type { TelemetryIdentity } from "./types.js";

export function buildAnalyticsDistinctId({ user, anonymousUser }: TelemetryIdentity): string {
  return buildSharedAnalyticsDistinctId({
    userId: user?.id,
    anonymousUserId: anonymousUser?.id,
  });
}
