import type { Context, Next } from "hono";

import { verifyCaptchaToken } from "~/lib/captcha";
import { RepositoryManager } from "~/repositories";
import { readBooleanEnv } from "~/utils/env";
import { getErrorMessage } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "middleware/captchaMiddleware" });

export async function validateCaptcha(c: Context, next: Next) {
  const user = c.get("user");
  const anonymousUser = c.get("anonymousUser");

  if (user) {
    return next();
  }

  if (!readBooleanEnv(c.env.REQUIRE_CAPTCHA_SECRET_KEY, false)) {
    return next();
  }

  if (!c.env.HCAPTCHA_SECRET_KEY || !c.env.HCAPTCHA_SITE_KEY) {
    logger.error("Captcha environment variables are not set");

    return c.json(
      {
        error: {
          message: "Captcha verification unavailable",
        },
      },
      503,
    );
  }

  logger.debug("Validating captcha for anonymous user");

  const userIP = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  if (anonymousUser && anonymousUser.captcha_verified === 1) {
    return next();
  }

  const captchaToken = c.req.header("X-Captcha-Token");

  if (!captchaToken) {
    return c.json(
      {
        error: {
          message: "Captcha verification required",
        },
      },
      403,
    );
  }

  let verificationResult: Awaited<ReturnType<typeof verifyCaptchaToken>>;

  try {
    verificationResult = await verifyCaptchaToken(
      captchaToken,
      c.env.HCAPTCHA_SECRET_KEY,
      c.env.HCAPTCHA_SITE_KEY,
    );
  } catch (error) {
    logger.error("Error handling captcha verification", { error: getErrorMessage(error) });

    return c.json(
      {
        error: {
          message: "Captcha verification unavailable",
        },
      },
      503,
    );
  }

  if (!verificationResult.verified) {
    return c.json(
      {
        error: {
          message: `Captcha verification failed: ${verificationResult.error || "Unknown error"}`,
        },
      },
      403,
    );
  }

  try {
    let repositories: RepositoryManager | null = null;
    const getRepositories = () => {
      if (!repositories) {
        repositories = RepositoryManager.getInstance(c.env);
      }

      return repositories;
    };

    if (anonymousUser) {
      await getRepositories().anonymousUsers.updateAnonymousUser(anonymousUser.id, {
        captcha_verified: 1,
      });
    } else {
      const createdAnonymousUser = await getRepositories().anonymousUsers.getOrCreateAnonymousUser(
        userIP,
        userAgent,
      );

      if (createdAnonymousUser) {
        await getRepositories().anonymousUsers.updateAnonymousUser(createdAnonymousUser.id, {
          captcha_verified: 1,
        });

        c.set("anonymousUser", { ...createdAnonymousUser, captcha_verified: 1 });
      }
    }
  } catch (error) {
    logger.error("Error persisting captcha verification", { error: getErrorMessage(error) });
  }

  logger.debug("Captcha verification successful");

  return next();
}
