import type { RateLimit } from "@cloudflare/workers-types";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { timeServerPhase } from "@ngriffin_uk/polychat-utility-server/server-timing";
import type { Context, Next } from "hono";

const logger = getLogger({ prefix: "middleware/ipRateLimit" });

export async function ipRateLimit(context: Context, next: Next) {
  const limiter: RateLimit | undefined = context.env.IP_RATE_LIMITER;
  const clientAddress = context.req.header("CF-Connecting-IP");
  const pathname = context.req.path;

  if (
    !limiter ||
    !clientAddress ||
    pathname === "/status" ||
    pathname === "/openapi" ||
    pathname.startsWith(`${SANDBOX_CREDENTIAL_BROKER_PATH_PREFIX}/`)
  ) {
    return next();
  }

  const result = await timeServerPhase("ip-ratelimit", () =>
    limiter.limit({ key: `ip-${clientAddress}` }),
  );

  if (!result.success) {
    logger.warn("IP rate limit exceeded", { pathname });

    throw new AssistantError(
      "Too many requests from this address. Try again shortly.",
      ErrorType.RATE_LIMIT_ERROR,
      429,
    );
  }

  return next();
}
