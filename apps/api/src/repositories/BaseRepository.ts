import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "BASE_REPOSITORY" });

export interface BatchStatement {
  sql: string;
  params?: any[];
}

export class BaseRepository {
  protected env: IEnv;

  constructor(env: IEnv) {
    if (!env?.DB) {
      throw new AssistantError(
        "Database not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
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
      throw new AssistantError(
        "DB is not configured in runQuery",
        ErrorType.CONFIGURATION_ERROR,
      );
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
      logger.error("Database query error:", { error });
      throw new AssistantError(
        `Error executing database query: ${error.message}`,
        ErrorType.UNKNOWN_ERROR,
        500,
        { originalError: error },
      );
    }
  }

  protected async executeRun(
    query: string,
    params: any[] = [],
  ): Promise<D1Result<unknown>> {
    if (!this.env.DB) {
      throw new AssistantError(
        "DB is not configured in executeRun",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    try {
      const stmt = this.env.DB.prepare(query);
      const bound = stmt.bind(...params);
      const result = await bound.run();

      if (!result.success) {
        throw new AssistantError(
          "Database operation failed",
          ErrorType.UNKNOWN_ERROR,
          500,
          { meta: result.meta },
        );
      }

      return result;
    } catch (error: any) {
      if (error instanceof AssistantError) {
        throw error;
      }
      logger.error("Database execution error:", { error });
      throw new AssistantError(
        `Error executing database operation: ${error.message}`,
        ErrorType.UNKNOWN_ERROR,
        500,
        { originalError: error },
      );
    }
  }

  // New: Execute multiple statements atomically using D1 batch API
  public async executeBatch(
    statements: BatchStatement[],
  ): Promise<D1Result<unknown>[]> {
    if (!this.env.DB) {
      throw new AssistantError(
        "DB is not configured in executeBatch",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (!Array.isArray(statements)) {
      throw new AssistantError(
        "Statements must be an array",
        ErrorType.PARAMS_ERROR,
      );
    }

    if (statements.length === 0) {
      return [];
    }

    try {
      const prepared = statements.map(({ sql, params = [] }) =>
        this.env.DB.prepare(sql).bind(...params),
      );
      const results = await this.env.DB.batch(prepared);

      // Validate all succeeded
      for (const res of results) {
        if (!res?.success) {
          throw new AssistantError(
            "One or more statements in batch failed",
            ErrorType.UNKNOWN_ERROR,
            500,
            { meta: res?.meta },
          );
        }
      }

      return results as D1Result<unknown>[];
    } catch (error: any) {
      if (error instanceof AssistantError) {
        throw error;
      }
      logger.error("Database batch execution error:", { error });
      throw new AssistantError(
        `Error executing database batch: ${error.message}`,
        ErrorType.UNKNOWN_ERROR,
        500,
        { originalError: error },
      );
    }
  }

  // New: Helper to build and run a transactional batch
  public async withTransaction(
    factory: () => BatchStatement[] | Promise<BatchStatement[]>,
  ): Promise<D1Result<unknown>[]> {
    try {
      const stmts = await factory();
      return await this.executeBatch(stmts);
    } catch (error) {
      // Preserve error shape
      if (error instanceof AssistantError) {
        throw error;
      }
      logger.error("withTransaction failed:", { error });
      throw new AssistantError(
        `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
        ErrorType.UNKNOWN_ERROR,
        500,
      );
    }
  }
}
