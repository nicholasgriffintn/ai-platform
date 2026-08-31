import type { Context } from "hono";
import { cors } from "hono/cors";

import { LOCAL_HOST, METRICS_LOCAL_HOST, METRICS_PROD_HOST, PROD_HOST } from "~/constants/app";

function getOriginHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

export function isAllowedOrigin(origin: string, environment: string): boolean {
  const host = getOriginHost(origin);

  if (!host) {
    return false;
  }

  if (environment === "production") {
    return host === PROD_HOST || host === METRICS_PROD_HOST;
  }

  if (environment === "development") {
    return host === LOCAL_HOST || host === METRICS_LOCAL_HOST;
  }

  return false;
}

const corsOrigin = (origin: string, context: Context) =>
  origin && isAllowedOrigin(origin, context.env.ENV) ? origin : "";

export const corsMiddleware = cors({
  origin: corsOrigin,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "Idempotency-Key",
    "x-captcha-token",
  ],
  credentials: true,
  maxAge: 86400,
});
