import { authorise, ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { SourceSyncRecord } from "~/modules/sources/infrastructure/SourceSyncRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function requireSourceSyncAccess(
  context: ServiceContext,
  sync: SourceSyncRecord,
  manage = false,
): Promise<void> {
  const user = context.requireUser();

  if (!sync.project_id) {
    if (!ownsResource(user.id, sync.created_by_user_id)) {
      throw new AssistantError("Source sync not found", ErrorType.NOT_FOUND, 404);
    }

    return;
  }

  const { role } = await requireProjectAccess(
    context,
    sync.project_id,
    manage ? ["owner", "admin"] : undefined,
  );

  if (
    !authorise(manage ? "resource.write" : "resource.read", {
      actorId: String(user.id),
      ownerId: String(sync.created_by_user_id),
      scope: "project",
      member: true,
      role,
    }).allowed
  ) {
    throw new AssistantError("Source sync access denied", ErrorType.FORBIDDEN, 403);
  }
}
