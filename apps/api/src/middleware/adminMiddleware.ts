import type { Context } from "hono";

export const requireAdmin = async (ctx: Context, next: () => Promise<void>) => {
  const user = ctx.get("user");

  if (!user?.role || !["admin", "moderator"].includes(user.role)) {
    return ctx.json(
      {
        status: "error",
        error: "Admin access required",
      },
      403,
    );
  }

  await next();
};

export const requireStrictAdmin = async (
  ctx: Context,
  next: () => Promise<void>,
) => {
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

  await next();
};

export const requireModerator = async (
  ctx: Context,
  next: () => Promise<void>,
) => {
  const user = ctx.get("user");

  if (!user?.role || !["admin", "moderator"].includes(user.role)) {
    return ctx.json(
      {
        status: "error",
        error: "Moderator access required",
      },
      403,
    );
  }

  await next();
};
