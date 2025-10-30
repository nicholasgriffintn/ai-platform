export const IS_PRODUCTION = import.meta.env.PROD;
export const IS_DEVELOPMENT = import.meta.env.DEV;
export const BUILD_MODE = import.meta.env.MODE;

export const APP_NAME = "Polychat";
export const APP_TAGLINE = "AI Assistant";
export const CONTACT_LINK = "https://nicholasgriffin.dev/contact";
export const JURISDICTION = "United Kingdom";
export const TERMS_EFFECTIVE_DATE = "March 30, 2025";
export const PRIVACY_EFFECTIVE_DATE = "March 30, 2025";
export const TRIAL_DURATION = 90;
export const CHATS_QUERY_KEY = "chats";

export const SHOW_DEV_TOOLS = IS_DEVELOPMENT;

export const API_BASE_URL = IS_PRODUCTION
  ? "https://api.polychat.app"
  : "http://localhost:8787";
export const WS_API_URL = IS_PRODUCTION
  ? "wss://api.polychat.app"
  : "ws://localhost:8787";

export const POSTHOG_CONFIG = {
  apiKey: import.meta.env.VITE_PUBLIC_POSTHOG_KEY || "disabled",
  apiHost: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "eu.i.posthog.com",
  debug: BUILD_MODE === "development",
  disabled: !import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
};

export const BEACON_CONFIG = {
  enabled: import.meta.env.VITE_ENABLE_BEACON === "true" || false,
  endpoint: import.meta.env.VITE_BEACON_ENDPOINT || "",
  siteId: import.meta.env.VITE_BEACON_SITE_ID || "",
  debug: import.meta.env.VITE_BEACON_DEBUG === "true" || false,
};

export const CAPTCHA_SITE_KEY = import.meta.env.VITE_CAPTCHA_SITE_KEY || "";
export const ENABLE_CAPTCHA_IN_DEV = false;

export const CSP = {
  defaultSrc: ["'self'"],
  frameSrc: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
  scriptSrc: [
    "eu.i.posthog.com",
    "eu-assets.i.posthog.com",
    "beacon.polychat.app",
    "https://unpkg.com/react@18/umd/react.development.js",
    "https://unpkg.com/react-dom@18/umd/react-dom.development.js",
    "https://hcaptcha.com",
    "https://*.hcaptcha.com",
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
  ],
  styleSrc: [
    "https://hcaptcha.com",
    "https://*.hcaptcha.com",
    "'self'",
    "'unsafe-inline'",
  ],
  imgSrc: [
    "openweathermap.org",
    "assistant-assets.nickgriffin.uk",
    "icons.duckduckgo.com",
    "avatars.githubusercontent.com/u/",
    "'self'",
    "data:",
  ],
  connectSrc: [
    "'self'",
    API_BASE_URL,
    WS_API_URL,
    "eu.i.posthog.com",
    "eu-assets.i.posthog.com",
    "beacon.polychat.app",
    "https://hcaptcha.com",
    "https://*.hcaptcha.com",
    "api.openai.com/v1/realtime",
    "https://huggingface.co",
    "https://raw.githubusercontent.com",
    "https://cdn-lfs-us-1.hf.co",
    "https://assistant-assets.nickgriffin.uk",
  ],
  mediaSrc: ["'self'", "data:", "https://assistant-assets.nickgriffin.uk"],
};

/**
 * Generates the Content Security Policy string from the CSP configuration
 */
export function generateCSP(): string {
  return Object.entries(CSP)
    .map(([directive, sources]) => {
      const directiveName = directive.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `${directiveName} ${sources.join(" ")}`;
    })
    .join("; ");
}

export const getAnalyticsConfig = () => POSTHOG_CONFIG;
export const getBeaconConfig = () => BEACON_CONFIG;
export const shouldShowDevTools = () => SHOW_DEV_TOOLS;
export const shouldEnableCaptcha = () =>
  CAPTCHA_SITE_KEY && (IS_PRODUCTION || ENABLE_CAPTCHA_IN_DEV);
