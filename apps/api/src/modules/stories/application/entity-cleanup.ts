import { correctEntityKind, isGenericEntity } from "~/modules/stories/domain/entities";
import { EntityRepository } from "~/modules/stories/infrastructure/EntityRepository";
import type { IEnv } from "~/types";

export interface EntityCleanupOutcome {
  removed: number;
  rekinded: number;
}

export async function cleanStoryEntities(env: IEnv): Promise<EntityCleanupOutcome> {
  const repository = new EntityRepository(env);
  const entities = await repository.listNames();
  const removed = entities.filter((entity) => isGenericEntity(entity.name));
  const rekinded = entities.filter(
    (entity) =>
      !isGenericEntity(entity.name) && correctEntityKind(entity.name, entity.kind) !== entity.kind,
  );

  await repository.removeMany(removed.map((entity) => entity.id));
  await repository.setKind(
    rekinded.map((entity) => entity.id),
    "place",
  );

  return { removed: removed.length, rekinded: rekinded.length };
}
