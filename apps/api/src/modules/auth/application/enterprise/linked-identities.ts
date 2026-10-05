import { linkedOidcIdentitiesResponseSchema } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

export async function listLinkedEnterpriseIdentities(context: ServiceContext) {
  const rows = await context.repositories.enterpriseIdentities.listLinkedForUser(
    context.requireUser().id,
  );

  return linkedOidcIdentitiesResponseSchema.parse({
    identities: rows.map((row) => ({
      connectionId: row.connection_id,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      label: row.label,
      enabled: row.enabled === 1,
      accessExpiresAt: row.identity_lease_expires_at,
    })),
  });
}
