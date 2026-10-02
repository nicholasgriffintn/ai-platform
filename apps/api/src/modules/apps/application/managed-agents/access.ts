import { bedrockManagedAgentRegionSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import { parseManagedAgentBinding } from "~/utils/managed-agent-records";

import { createManagedAgentsClient } from "./credentials";

export async function loadManagedAgentSession(
  context: ServiceContext,
  id: string,
  options: { write?: boolean; allowDeleted?: boolean } = {},
) {
  const user = context.requireUser();
  const record = await context.repositories.activities.getActivityById(id);

  if (!record || (!record.project_id && record.created_by_user_id !== user.id)) {
    throw new AssistantError("Managed agent session not found", ErrorType.NOT_FOUND, 404);
  }

  if (record.project_id) {
    await requireProjectAccess(
      context,
      record.project_id,
      options.write ? ["owner", "admin"] : undefined,
    );
  }

  const binding = parseManagedAgentBinding(record);

  if (!binding) {
    throw new AssistantError("Managed agent session not found", ErrorType.NOT_FOUND, 404);
  }

  if ((binding.deleted && !options.allowDeleted) || !binding.sessionId) {
    throw new AssistantError("Managed agent session is unavailable", ErrorType.CONFLICT_ERROR, 409);
  }

  const region = bedrockManagedAgentRegionSchema.parse(
    binding.configuration.environment.runtime_arn.split(":")[3],
  );
  const client = createManagedAgentsClient(
    context,
    region,
    record.project_id ?? undefined,
    options.write,
  );

  return { record, binding, sessionId: binding.sessionId, client };
}
