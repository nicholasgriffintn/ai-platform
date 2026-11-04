import type { MiddlewareHandler } from "hono";

export const noStore: MiddlewareHandler = async (context, next) => {
  await next();
  context.header("Cache-Control", "no-store");
};
