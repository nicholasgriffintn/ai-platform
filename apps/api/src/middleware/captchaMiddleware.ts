import type { Context, Next } from "hono";

import { verifyCaptchaToken } from "~/lib/captcha";
import { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "middleware/captchaMiddleware" });

/**
 * Middleware to validate captcha token
 * Verifies token only once per session instead of per request
 */
export async function validateCaptcha(c: Context, next: Next) {
	const user = c.get("user");
	const anonymousUser = c.get("anonymousUser");

	if (user) {
		return next();
	}

	if (!c.env.REQUIRE_CAPTCHA_SECRET_KEY) {
		return next();
	}

	if (!c.env.HCAPTCHA_SECRET_KEY || !c.env.HCAPTCHA_SITE_KEY) {
		logger.error("Captcha environment variables are not set");
		return next();
	}

	try {
		logger.debug("Validating captcha for anonymous user");

		const userIP =
			c.req.header("cf-connecting-ip") ||
			c.req.header("x-forwarded-for") ||
			"unknown";
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

		const { verified, error } = await verifyCaptchaToken(
			captchaToken,
			c.env.HCAPTCHA_SECRET_KEY,
			c.env.HCAPTCHA_SITE_KEY,
		);

		if (!verified) {
			return c.json(
				{
					error: {
						message: `Captcha verification failed: ${error || "Unknown error"}`,
					},
				},
				403,
			);
		}

		let repositories: RepositoryManager | null = null;
		const getRepositories = () => {
			if (!repositories) {
				repositories = RepositoryManager.getInstance(c.env);
			}
			return repositories;
		};

		if (anonymousUser) {
			await getRepositories().anonymousUsers.updateAnonymousUser(
				anonymousUser.id,
				{
					captcha_verified: 1,
				},
			);
		} else {
			const user =
				await getRepositories().anonymousUsers.getOrCreateAnonymousUser(
					userIP,
					userAgent,
				);
			if (user) {
				await getRepositories().anonymousUsers.updateAnonymousUser(user.id, {
					captcha_verified: 1,
				});

				c.set("anonymousUser", { ...user, captcha_verified: 1 });
			}
		}

		logger.debug("Captcha verification successful");
	} catch (error) {
		logger.error(`Error handling captcha verification: ${error}`);
	}

	return next();
}
