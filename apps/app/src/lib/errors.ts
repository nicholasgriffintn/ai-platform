export { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { ApiError } from "@ngriffin_uk/polychat-library-client";

const AUTHENTICATION_ERROR_MESSAGE = "Authentication failed. Please check your credentials.";
const AUTHENTICATION_ERROR_PATTERN =
  /authentication failed|authentication required|not authenticated|unauthori[sz]ed/i;

export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401;
  }

  if (error instanceof Error) {
    return (
      error.message === AUTHENTICATION_ERROR_MESSAGE ||
      AUTHENTICATION_ERROR_PATTERN.test(error.message)
    );
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  if ("status" in error && typeof error.status === "number") {
    return error.status === 401;
  }

  return "statusCode" in error && typeof error.statusCode === "number" && error.statusCode === 401;
}
