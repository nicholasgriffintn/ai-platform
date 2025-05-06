import { getLogger } from "./logger";

const errorLogger = getLogger({ prefix: "ERROR_HANDLER" });

export interface ErrorLogContext {
  userId?: string | number;
  path?: string;
  operation?: string;
  [key: string]: any;
}

/**
 * Standardized error logging function to ensure consistent logging format across the codebase
 *
 * @param message A descriptive message about the error
 * @param error The error object that was caught
 * @param context Additional context information about the error
 */
export function logError(
  message: string,
  error: unknown,
  context: ErrorLogContext = {},
): void {
  const errorDetails = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    name: error instanceof Error ? error.name : typeof error,
    ...context,
  };

  errorLogger.error(message, errorDetails);
}
