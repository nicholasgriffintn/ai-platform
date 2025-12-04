import type { Context, Next } from "hono";

export function securityHeaders() {
	return async (c: Context, next: Next) => {
		c.header("X-Content-Type-Options", "nosniff");
		c.header("X-Frame-Options", "DENY");
		c.header("X-XSS-Protection", "1; mode=block");
		c.header("Cross-Origin-Opener-Policy", "same-origin");
		c.header("Cross-Origin-Resource-Policy", "same-origin");
		c.header("X-DNS-Prefetch-Control", "off");
		c.header("Cross-Origin-Embedder-Policy", "require-corp");
		c.header(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains",
		);
		c.header("Referrer-Policy", "strict-origin-when-cross-origin");
		c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

		await next();
	};
}
