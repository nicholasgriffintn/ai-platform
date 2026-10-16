import type { IEnv } from "~/types";

export type RepositoryConstructor<Repository> = new (env: IEnv) => Repository;

export interface Repositories {
  get<Repository>(Repository: RepositoryConstructor<Repository>): Repository;
}

export function createRepositories(env: IEnv): Repositories {
  return {
    get: (Repository) => new Repository(env),
  };
}
