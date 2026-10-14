import type { MiddlewareHandler } from "hono";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { requirePlan } from "~/middleware/requirePlan";
import { requireOptionalProjectCapabilityAccess } from "~/modules/workspaces/application/access";

export function requireExperience(capabilityId: string): MiddlewareHandler {
  return async (context, next) => {
    await requireOptionalProjectCapabilityAccess(
      getServiceContext(context),
      context.req.query("project_id") || undefined,
      "app",
      capabilityId,
    );
    await next();
  };
}

export function proExperience(capabilityId: string): MiddlewareHandler[] {
  return [requirePlan("pro"), requireExperience(capabilityId)];
}
