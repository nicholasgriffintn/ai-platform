import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { Context } from "hono";

export const requireAdmin = async (ctx: Context, next: () => Promise<void>) => {
  const user = ctx.get("user");

  const isAuthorised = authorise("platform.admin", {
    role: user?.role ?? "",
    strict: false,
  }).allowed;

  if (!isAuthorised) {
    return ctx.json(
      {
        status: "error",
        error: "Admin access required",
      },
      403,
    );
  }

  return next();
};

export const requireStrictAdmin = async (ctx: Context, next: () => Promise<void>) => {
  const user = ctx.get("user");

  const isAuthorised = authorise("platform.admin", {
    role: user?.role ?? "",
    strict: true,
  }).allowed;

  if (!isAuthorised) {
    return ctx.json(
      {
        status: "error",
        error: "Admin access required",
      },
      403,
    );
  }

  return next();
};
