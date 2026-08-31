import type { D1Database } from "@cloudflare/workers-types";

import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export * as schema from "./schema";
export { createDatabaseClient, type DatabaseClient } from "./client";

export interface Env {
  DB: D1Database;
}

/**
 * Database class - lightweight wrapper around RepositoryManager
 * Provides access to repositories and database connection
 * Most database operations should be done through repositories directly via ServiceContext
 */
export class Database {
  private _repositories: RepositoryManager;
  private env: IEnv;

  constructor(env: IEnv) {
    if (!env?.DB) {
      throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
    }

    this.env = env;
    this._repositories = new RepositoryManager(env);
  }

  public static getInstance(env: IEnv): Database {
    return new Database(env);
  }

  /**
   * Get the repository manager for direct repository access
   * Prefer using context.repositories in services
   */
  public get repositories(): RepositoryManager {
    return this._repositories;
  }

  public get connection(): D1Database {
    return this.env.DB;
  }
}
