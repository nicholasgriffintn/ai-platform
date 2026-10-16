import type { Repositories, RepositoryConstructor } from "~/infrastructure/database/repositories";

export function fakeRepositories(
  fakes: ReadonlyArray<readonly [RepositoryConstructor<unknown>, unknown]>,
): Repositories {
  const byRepository = new Map(fakes);

  return {
    get: (Repository) => {
      if (!byRepository.has(Repository)) {
        throw new Error(`No fake registered for ${Repository.name}`);
      }

      return byRepository.get(Repository) as InstanceType<typeof Repository>;
    },
  };
}
