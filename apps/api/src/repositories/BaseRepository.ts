import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "BASE_REPOSITORY" });

// Cache for prepared statements to avoid re-compilation
const statementCache = new Map<string, any>();

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

  /**
   * Get or create a prepared statement with caching
   */
  private getPreparedStatement(query: string) {
    if (statementCache.has(query)) {
      return statementCache.get(query);
    }
    
    const stmt = this.env.DB.prepare(query);
    
    // Limit cache size to prevent memory issues
    if (statementCache.size > 100) {
      const firstKey = statementCache.keys().next().value;
      statementCache.delete(firstKey);
    }
    
    statementCache.set(query, stmt);
    return stmt;
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
      const stmt = this.getPreparedStatement(query);
      const bound = stmt.bind(...params);

      if (returnFirst) {
        const result = await bound.first();
        return result as T | null;
      }

      const result = await bound.all();
      return result.results as T[];
    } catch (error: any) {
      logger.error("Database query error:", { 
        error: error.message,
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        paramsCount: params.length
      });
      throw new AssistantError(
        `Error executing database query: ${error.message}`,
        ErrorType.UNKNOWN_ERROR,
        500,
        { originalError: error },
      );
    }
  }

  /**
   * Execute multiple queries in a batch for better performance
   */
  protected async runBatchQueries<T>(
    queries: Array<{ query: string; params: any[] }>,
    returnFirst = false
  ): Promise<T[]> {
    if (!this.env.DB) {
      throw new AssistantError(
        "DB is not configured in runBatchQueries",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    try {
      const promises = queries.map(async ({ query, params }) => {
        const stmt = this.getPreparedStatement(query);
        const bound = stmt.bind(...params);
        
        if (returnFirst) {
          return await bound.first();
        }
        
        const result = await bound.all();
        return result.results;
      });

      const results = await Promise.all(promises);
      return results.flat() as T[];
    } catch (error: any) {
      logger.error("Database batch query error:", { 
        error: error.message,
        queryCount: queries.length
      });
      throw new AssistantError(
        `Error executing batch database queries: ${error.message}`,
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
      const stmt = this.getPreparedStatement(query);
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
      logger.error("Database execution error:", { 
        error: error.message,
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        paramsCount: params.length
      });
      throw new AssistantError(
        `Error executing database operation: ${error.message}`,
        ErrorType.UNKNOWN_ERROR,
        500,
        { originalError: error },
      );
    }
  }
}
