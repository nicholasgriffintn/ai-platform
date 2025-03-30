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
export const CHATS_QUERY_KEY = "chats";
export const TURNSTILE_SITE_KEY = IS_PRODUCTION
  ? "0x4AAAAAABB3--lj9wHKjSld"
  : undefined;
