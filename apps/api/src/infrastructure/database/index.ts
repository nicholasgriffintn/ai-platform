import type { D1Database } from "@cloudflare/workers-types";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createRepositories, type Repositories } from "~/infrastructure/database/repositories";
import type { IEnv } from "~/types";

export * as schema from "./schema";
export { createDatabaseClient, type DatabaseClient } from "./client";

export interface Env {
  DB: D1Database;
}

export class Database {
  private _repositories: Repositories;
  private env: IEnv;

  constructor(env: IEnv) {
    if (!env?.DB) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    this.env = env;
    this._repositories = createRepositories(env);
  }

  public static getInstance(env: IEnv): Database {
    return new Database(env);
  }

  public get repositories(): Repositories {
    return this._repositories;
  }

  public get connection(): D1Database {
    return this.env.DB;
  }
}
