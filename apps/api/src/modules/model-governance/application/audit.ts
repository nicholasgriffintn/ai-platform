import {
  type ModelAuditQuery,
  modelAuditQuerySchema,
  type WorkspaceAuditRecord,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { formatAuditRecord } from "~/modules/audit/application";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { requireModelAction } from "~/modules/model-registry/application/access";

export async function listModelAudit(
  context: ServiceContext,
  workspaceId: string,
  input: Partial<ModelAuditQuery>,
): Promise<{ events: WorkspaceAuditRecord[] }> {
  await requireModelAction(context, workspaceId, "view");

  const query = modelAuditQuerySchema.parse(input);

  return {
    events: (
      await context.repositories.get(AuditRepository).listModelRecords(workspaceId, query)
    ).map(formatAuditRecord),
  };
}
