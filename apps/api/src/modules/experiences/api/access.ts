import type { MiddlewareHandler } from "hono";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { requirePlan } from "~/middleware/requirePlan";
import { requireOptionalProjectCapabilityAccess } from "~/modules/workspaces/application/access";

export function requireExperience(capabilityId: string): MiddlewareHandler {
  const requirePro = requirePlan("pro");

  return async (context, next) => {
    await requirePro(context, async () => {
      await requireOptionalProjectCapabilityAccess(
        getServiceContext(context),
        context.req.query("project_id") || undefined,
        "app",
        capabilityId,
      );
      await next();
    });
  };
}
