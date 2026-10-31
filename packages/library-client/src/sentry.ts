import type { ClientAnalyticsApp } from "@ngriffin_uk/polychat-schemas/analytics";
import * as Sentry from "@sentry/browser";

import { getAnalyticsSessionId } from "./analytics.js";
import { API_BASE_URL, BUILD_MODE, SENTRY_DSN } from "./constants.js";

export function initSentry({ app, release }: { app: ClientAnalyticsApp; release: string }): void {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: BUILD_MODE,
    release,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    tracePropagationTargets: [API_BASE_URL],
  });

  Sentry.setTag("app", app);

  const sessionId = getAnalyticsSessionId();

  if (sessionId) {
    Sentry.setTag("session_id", sessionId);
  }
}

export function captureClientError(error: unknown): void {
  Sentry.captureException(error);
}
