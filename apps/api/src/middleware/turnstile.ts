import type { Context, Next } from "hono";

import { AssistantError, ErrorType } from "../utils/errors";

export async function requireTurnstileToken(context: Context, next: Next) {
  if (context.env.REQUIRE_TURNSTILE_TOKEN !== "true") {
    return next();
  }

  if (!context.env.TURNSTILE_SECRET_KEY) {
    throw new AssistantError(
      "Turnstile secret key is not set",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const turnstileToken = context.req.header("X-Turnstile-Token");
  if (!turnstileToken) {
    return context.json({ error: "Missing turnstile token" }, 400);
  }

  const ip = context.req.header("X-Forwarded-For");

  const turnstileResponse = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: JSON.stringify({
        secret: context.env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: ip,
      }),
    },
  );

  const data = (await turnstileResponse.json()) as { success: boolean };

  if (!data.success) {
    return context.json({ error: "Unauthorized" }, 401);
  }

  next();
}
