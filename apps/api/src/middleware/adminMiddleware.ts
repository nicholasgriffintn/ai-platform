import type { Context } from "hono";

export const requireAdmin = async (ctx: Context, next: () => Promise<void>) => {
  const user = ctx.get("user");

  if (!user?.role || (user.role !== "admin" && user.role !== "moderator")) {
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

  if (!user?.role || user.role !== "admin") {
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
