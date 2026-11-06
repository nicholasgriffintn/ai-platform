import type { RateLimit } from "@cloudflare/workers-types";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { timeServerPhase } from "@ngriffin_uk/polychat-utility-server/server-timing";
import type { Context, Next } from "hono";

const logger = getLogger({ prefix: "middleware/provenanceRateLimit" });

export async function provenanceLookupRateLimit(context: Context, next: Next) {
  const limiter: RateLimit | undefined = context.env.PROVENANCE_RATE_LIMITER;

  if (!limiter) {
    throw new AssistantError("Rate limiter not configured", ErrorType.CONFIGURATION_ERROR);
  }

  const clientAddress = context.req.header("CF-Connecting-IP") ?? "unknown";
  const result = await timeServerPhase("provenance-ratelimit", () =>
    limiter.limit({ key: `provenance-${clientAddress}` }),
  );

  if (!result.success) {
    logger.warn("Provenance lookup rate limit exceeded");

    throw new AssistantError(
      "Too many provenance lookups. Try again shortly.",
      ErrorType.RATE_LIMIT_ERROR,
      429,
    );
  }

  return next();
}
