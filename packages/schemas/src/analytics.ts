import z from "zod/v4";

export const ANALYTICS_EVENT_CATEGORIES = {
  AUTH: "authentication",
  CONVERSATION: "conversation",
  UI_INTERACTION: "ui_interaction",
  FEATURE_USAGE: "feature_usage",
  ERROR: "error",
  USER_JOURNEY: "user_journey",
  NAVIGATION: "navigation",
  SESSION: "session",
} as const;

export type AnalyticsPropertyValue = string | number | boolean | null | undefined;
export type AnalyticsEventProperties = Record<string, AnalyticsPropertyValue>;

export type AnalyticsEvent = {
  name: string;
  category: string;
  label?: string;
  value?: number | string;
  nonInteraction?: boolean;
  properties?: AnalyticsEventProperties;
};

export type AnalyticsIdentity = {
  userId?: string | number | null;
  anonymousUserId?: string | null;
  fallback?: string;
};

export type AnalyticsTrackingPolicyInput = {
  isAuthenticated?: boolean;
  userTrackingEnabled?: boolean | null;
  requireAuthenticatedPreference?: boolean;
};

export function buildAnalyticsDistinctId({
  userId,
  anonymousUserId,
  fallback = "anonymous:server",
}: AnalyticsIdentity): string {
  if (userId !== undefined && userId !== null) {
    return `user:${String(userId)}`;
  }

  if (anonymousUserId) {
    return `anonymous:${anonymousUserId}`;
  }

  return fallback;
}

export function isAnalyticsTrackingEnabled({
  isAuthenticated = false,
  userTrackingEnabled,
  requireAuthenticatedPreference = false,
}: AnalyticsTrackingPolicyInput): boolean {
  if (!isAuthenticated) {
    return true;
  }

  if (userTrackingEnabled === false) {
    return false;
  }

  if (requireAuthenticatedPreference && userTrackingEnabled === undefined) {
    return false;
  }

  return true;
}

export function compactAnalyticsProperties(
  properties: AnalyticsEventProperties | undefined,
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};

  if (!properties) {
    return output;
  }

  for (const [key, value] of Object.entries(properties)) {
    if (value !== null && value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

export const CLIENT_ANALYTICS_BATCH_LIMIT = 50;

const CLIENT_ANALYTICS_PROPERTY_LIMIT = 30;

export const clientAnalyticsEventSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  label: z.string().max(200).optional(),
  value: z.union([z.number(), z.string().max(200)]).optional(),
  nonInteraction: z.boolean().optional(),
  path: z.string().max(500).optional(),
  properties: z
    .record(z.string().max(64), z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]))
    .refine((properties) => Object.keys(properties).length <= CLIENT_ANALYTICS_PROPERTY_LIMIT, {
      message: `At most ${CLIENT_ANALYTICS_PROPERTY_LIMIT} properties per event`,
    })
    .optional(),
});

export const CLIENT_ANALYTICS_APPS = ["web", "desktop", "ios"] as const;

export const clientAnalyticsAppSchema = z.enum(CLIENT_ANALYTICS_APPS);

export const clientAnalyticsBatchSchema = z.object({
  app: clientAnalyticsAppSchema,
  environment: z.string().min(1).max(32),
  appVersion: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
  events: z.array(clientAnalyticsEventSchema).min(1).max(CLIENT_ANALYTICS_BATCH_LIMIT),
});

export const clientAnalyticsBatchResponseSchema = z.object({ accepted: z.number().int() });

export type ClientAnalyticsEvent = z.infer<typeof clientAnalyticsEventSchema>;
export type ClientAnalyticsBatch = z.infer<typeof clientAnalyticsBatchSchema>;
export type ClientAnalyticsApp = z.infer<typeof clientAnalyticsAppSchema>;
