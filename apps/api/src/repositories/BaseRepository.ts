import type { IEnv } from "../types";
import { AssistantError } from "../utils/errors";

export class BaseRepository {
  protected env: IEnv;

  constructor(env: IEnv) {
    if (!env?.DB) {
      throw new Error("Database not configured");
    }
    this.env = env;
  }

  protected async runQuery<T>(
    query: string,
    params: any[],
    returnFirst: true,
  ): Promise<T | null>;
  protected async runQuery<T>(
    query: string,
    params?: any[],
    returnFirst?: false,
  ): Promise<T[]>;
  protected async runQuery<T>(
    query: string,
    params: any[] = [],
    returnFirst = false,
  ): Promise<T | T[] | null> {
    if (!this.env.DB) {
      throw new Error("DB is not configured");
    }

    try {
      const stmt = this.env.DB.prepare(query);
      const bound = stmt.bind(...params);

      if (returnFirst) {
        const result = await bound.first();
        return result as T | null;
      }

      const result = await bound.all();
      return result.results as T[];
    } catch (error: any) {
      console.error("Database query error:", error);
      throw new AssistantError(
        `Error executing database query: ${error.message}`,
      );
    }
  }

  protected async executeRun(
    query: string,
    params: any[] = [],
  ): Promise<D1Result<unknown>> {
    if (!this.env.DB) {
      throw new Error("DB is not configured");
    }

    try {
      const stmt = this.env.DB.prepare(query);
      const bound = stmt.bind(...params);
      const result = await bound.run();

      if (!result.success) {
        throw new AssistantError("Database operation failed");
      }

      return result;
    } catch (error: any) {
      console.error("Database execution error:", error);
      throw new AssistantError(
        `Error executing database operation: ${error.message}`,
      );
    }
  }
}
