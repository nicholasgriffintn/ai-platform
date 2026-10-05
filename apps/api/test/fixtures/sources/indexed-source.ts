import type { D1Database } from "@cloudflare/workers-types";

import type { SourceSearchRepository } from "~/modules/sources/infrastructure/SourceSearchRepository";

export async function addIndexedKnowledgeSource(
  database: D1Database,
  repository: SourceSearchRepository,
  input: { id: string; projectId: string | null; userId: number; connectionId: string | null },
): Promise<void> {
  await database
    .prepare(`INSERT INTO source (id, created_by_user_id, project_id, title, kind, status, content, connection_id)
    VALUES (?, ?, ?, 'Incident decisions', 'text', 'available', 'INC-4821 release decision', ?)`)
    .bind(input.id, input.userId, input.projectId, input.connectionId)
    .run();
  const source = await repository.getSource(input.id);

  if (!source) {
    throw new Error("Knowledge fixture source missing");
  }

  await repository.prepare(
    source,
    {
      documentId: `index-${input.id}`,
      logicalId: input.id,
      title: source.title,
      content: source.content ?? "",
      chunks: [
        {
          id: `vector-${input.id}`,
          vectorId: `vector-${input.id}`,
          index: 0,
          content: source.content ?? "",
        },
      ],
    },
    {
      embeddingProvider: "vectorize",
      providerTarget: "vectorize-binding",
      model: "@cf/baai/bge-base-en-v1.5",
      dimensions: 768,
      distanceMetric: "cosine",
      taskMode: "symmetric",
      vectorSpace: "default",
      vectorSpaceVersion: "1",
    },
    input.userId,
  );
  await repository.claim(`index-${input.id}`, "fixture", "lexical");
  if (!(await repository.activate(`index-${input.id}`, "fixture"))) {
    throw new Error("Knowledge fixture activation failed");
  }

  await repository.release(`index-${input.id}`, "fixture");
}
