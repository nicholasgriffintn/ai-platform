import { getAnalyticsConfig } from "@ngriffin_uk/polychat-library-client";
import { useEffect, useState } from "react";

import type { ClientPostHog } from "../lib/analytics/client.js";

let postHogClientPromise: Promise<ClientPostHog | null> | null = null;

export function loadPostHogClient(): Promise<ClientPostHog | null> {
  const config = getAnalyticsConfig();
  const isDisabled =
    config.disabled || !config.apiKey || config.apiKey === "disabled" || !config.apiHost;

  if (isDisabled) {
    return Promise.resolve(null);
  }

  postHogClientPromise ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(config.apiKey, {
        api_host: config.apiHost,
        capture_exceptions: true,
        debug: config.debug,
      });

      return posthog;
    })
    .catch(() => {
      postHogClientPromise = null;

      return null;
    });

  return postHogClientPromise;
}

export function usePostHogClient(): ClientPostHog | null {
  const [client, setClient] = useState<ClientPostHog | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const posthog = await loadPostHogClient();

      if (isMounted) {
        setClient(posthog);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return client;
}
