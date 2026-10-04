import type { D1Database } from "@cloudflare/workers-types";

import type { SourceIndexRepository } from "~/modules/sources/infrastructure/SourceIndexRepository";

export async function addIndexedKnowledgeSource(
  database: D1Database,
  repository: SourceIndexRepository,
  input: { id: string; projectId: string | null; userId: number; connectionId: string | null },
): Promise<void> {
  await database
    .prepare(`INSERT INTO source (id, created_by_user_id, project_id, title, kind, status, content, connection_id)
    VALUES (?, ?, ?, 'Incident decisions', 'text', 'available', 'INC-4821 release decision', ?)`)
    .bind(input.id, input.userId, input.projectId, input.connectionId)
    .run();
  await repository.prepare({
    id: `index-${input.id}`,
    sourceId: input.id,
    revision: 1,
    userId: input.userId,
    target: "{}",
    title: "Incident decisions",
    chunks: [
      {
        id: `chunk-${input.id}`,
        vectorId: `vector-${input.id}`,
        index: 0,
        content: "INC-4821 release decision",
      },
    ],
  });

  if (!(await repository.activate(`index-${input.id}`))) {
    throw new Error("Could not activate the knowledge source fixture");
  }
}
