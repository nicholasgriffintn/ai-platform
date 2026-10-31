import {
  CLIENT_ANALYTICS_BATCH_LIMIT,
  type ClientAnalyticsApp,
  type ClientAnalyticsEvent,
} from "@ngriffin_uk/polychat-schemas/analytics";

import { ANALYTICS_CONFIG, BUILD_MODE } from "./constants.js";
import { fetchApi } from "./fetch-wrapper.js";

const ANALYTICS_FLUSH_DELAY_MS = 2_000;

const sessionId = globalThis.crypto?.randomUUID?.();

let app: ClientAnalyticsApp = "web";
let appVersion: string | undefined;
let queue: ClientAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let listeningForPageHide = false;

function listenForPageHide(): void {
  if (listeningForPageHide || typeof window === "undefined") {
    return;
  }

  listeningForPageHide = true;
  window.addEventListener("pagehide", () => void flushAnalyticsEvents({ keepalive: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushAnalyticsEvents({ keepalive: true });
    }
  });
}

export async function flushAnalyticsEvents({ keepalive = false } = {}): Promise<void> {
  clearTimeout(flushTimer);
  flushTimer = undefined;

  while (queue.length > 0) {
    const events = queue.slice(0, CLIENT_ANALYTICS_BATCH_LIMIT);

    queue = queue.slice(CLIENT_ANALYTICS_BATCH_LIMIT);

    await fetchApi("/ripple", {
      method: "POST",
      body: { app, environment: BUILD_MODE || "unknown", appVersion, sessionId, events },
      keepalive,
    }).catch(() => undefined);
  }
}

export function setAnalyticsApp(next: ClientAnalyticsApp, version?: string): void {
  app = next;
  appVersion = version;
}

export function queueAnalyticsEvent(event: ClientAnalyticsEvent): void {
  if (!ANALYTICS_CONFIG.enabled) {
    return;
  }

  listenForPageHide();
  queue.push({ ...event, path: event.path ?? globalThis.location?.pathname });

  if (queue.length >= CLIENT_ANALYTICS_BATCH_LIMIT) {
    void flushAnalyticsEvents();

    return;
  }

  flushTimer ??= setTimeout(() => void flushAnalyticsEvents(), ANALYTICS_FLUSH_DELAY_MS);
}
