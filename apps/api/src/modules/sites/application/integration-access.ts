import { SITES_CAPABILITY_ID, type SiteIntegrationScope } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireOutputAccess } from "~/modules/outputs/application/access";
import { requireOptionalProjectCapabilityAccess } from "~/modules/workspaces/application/access";

import { getSite } from "./records";

export async function requireSiteIntegrationAccess(
  context: ServiceContext,
  siteId: string,
  scope: SiteIntegrationScope,
  mutate = false,
) {
  const user = context.requireUser();

  await requireOptionalProjectCapabilityAccess(
    context,
    scope.projectId,
    "app",
    SITES_CAPABILITY_ID,
  );
  await requireOutputAccess(context, user.id, siteId, mutate);
  const site = await getSite({ context, userId: user.id, projectId: scope.projectId }, siteId);

  if (site.revision !== scope.expectedRevision) {
    throw new AssistantError(
      "The site changed. Reload before continuing",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return site;
}
