import { mcpConnectionSchema } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ProviderConnectionRecord } from "~/modules/apps/infrastructure/ProviderConnectionRepository";

export function publicMcpConnection(record: ProviderConnectionRecord) {
  const metadata = mcpConnectionSchema
    .omit({ id: true, createdAt: true })
    .parse(safeParseJson(record.metadata));

  return { ...metadata, id: record.id, createdAt: record.created_at };
}
