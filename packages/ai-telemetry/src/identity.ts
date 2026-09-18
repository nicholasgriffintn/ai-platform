import { buildAnalyticsDistinctId as buildSharedAnalyticsDistinctId } from "@ngriffin_uk/polychat-schemas";

import type {
  TelemetryIdentity,
  TelemetryIdentityInput,
  TelemetryPersonProperties,
} from "./types.js";

export function buildAnalyticsDistinctId({ user, anonymousUser }: TelemetryIdentity): string {
  return buildSharedAnalyticsDistinctId({
    userId: user?.id,
    anonymousUserId: anonymousUser?.id,
  });
}

export function resolveAnalyticsDistinctId(identity?: TelemetryIdentityInput): string | undefined {
  if (identity?.userId !== undefined && identity?.userId !== null) {
    return buildSharedAnalyticsDistinctId({ userId: identity.userId });
  }

  if (identity?.anonymousUserId) {
    return buildSharedAnalyticsDistinctId({ anonymousUserId: identity.anonymousUserId });
  }

  return undefined;
}

export function buildTelemetryPersonProperties(
  identity?: TelemetryIdentityInput,
): TelemetryPersonProperties | undefined {
  if (!identity) {
    return undefined;
  }

  const properties: TelemetryPersonProperties = {};

  if (identity.userId !== undefined && identity.userId !== null) {
    properties.user_id = String(identity.userId);
  }

  if (identity.email) {
    properties.email = identity.email;
  }

  if (identity.planId) {
    properties.plan_id = identity.planId;
  }

  if (identity.anonymousUserId) {
    properties.anonymous_id = identity.anonymousUserId;
  }

  return Object.keys(properties).length > 0 ? properties : undefined;
}
