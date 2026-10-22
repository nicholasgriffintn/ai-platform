import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  createSourceCollection,
  listSourceCollections,
} from "~/modules/sources/application/sources";

/** Finds the podcast show with this name in the scope, creating it the first time. */
export async function ensurePodcastShow(
  context: ServiceContext,
  userId: number,
  projectId: string | null,
  title: string,
): Promise<string> {
  const name = title.trim();
  const shows = await listSourceCollections(context, userId, projectId ?? undefined);
  const existing = shows.data.find(
    (show) => show.kind === "podcast" && show.title.toLowerCase() === name.toLowerCase(),
  );

  if (existing) {
    return existing.id;
  }

  const created = await createSourceCollection(context, userId, {
    projectId,
    title: name.slice(0, 120),
    kind: "podcast",
  });

  return created.id;
}
