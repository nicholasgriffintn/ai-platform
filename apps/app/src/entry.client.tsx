import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { getAnalyticsConfig } from "~/constants";

import "./styles/index.css";

const analyticsConfig = getAnalyticsConfig();

hydrateRoot(
  document,
  <StrictMode>
    {analyticsConfig.disabled ? (
      <HydratedRouter />
    ) : (
      <PostHogProvider
        apiKey={analyticsConfig.apiKey}
        options={{
          api_host: analyticsConfig.apiHost,
          capture_exceptions: true,
          debug: analyticsConfig.debug,
        }}
      >
        <HydratedRouter />
      </PostHogProvider>
    )}
  </StrictMode>,
);
