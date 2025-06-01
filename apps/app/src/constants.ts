export const IS_PRODUCTION = import.meta.env.PROD;

export const APP_NAME = "Polychat";
export const APP_TAGLINE = "AI Assistant";
export const CONTACT_LINK = "https://nicholasgriffin.dev/contact";
export const JURISDICTION = "United Kingdom";
export const TERMS_EFFECTIVE_DATE = "March 30, 2025";
export const PRIVACY_EFFECTIVE_DATE = "March 30, 2025";
export const API_BASE_URL = IS_PRODUCTION
  ? "https://api.polychat.app"
  : "http://localhost:8787";
export const WS_API_URL = IS_PRODUCTION
  ? "wss://api.polychat.app"
  : "ws://localhost:8787";
export const CHATS_QUERY_KEY = "chats";
export const CAPTCHA_SITE_KEY = "e17a69e0-b022-4d1c-b568-0ac0f3909f0c";
export const TRIAL_DURATION = 90;

export const CSP = {
  defaultSrc: ["'self'"],
  frameSrc: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
  scriptSrc: [
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
