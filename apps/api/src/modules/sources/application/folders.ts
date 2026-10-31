import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createSourceCollection,
  listSourceCollections,
} from "~/modules/sources/application/sources";

export async function ensureFolder(
  context: ServiceContext,
  userId: number,
  folder: { projectId: string | null; title: string; kind: "general" | "podcast" },
): Promise<{ id: string; created: boolean }> {
  const name = folder.title.trim();
  const folders = await listSourceCollections(context, userId, {
    projectId: folder.projectId ?? undefined,
    kinds: [folder.kind],
  });
  const existing = folders.data.find(
    (candidate) => candidate.title.toLowerCase() === name.toLowerCase(),
  );

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await createSourceCollection(context, userId, {
    projectId: folder.projectId,
    title: name.slice(0, 120),
    kind: folder.kind,
  });

  return { id: created.id, created: true };
}
