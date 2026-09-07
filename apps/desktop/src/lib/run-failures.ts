import { getErrorMessage, truncateText } from "@ngriffin_uk/polychat-library-react";

const MESSAGE_LIMIT = 400;
const REFUSED = "The desktop bridge refused this run.";

export function describeRunFailure(cause: unknown): string {
  return truncateText(getErrorMessage(cause, REFUSED).trim() || REFUSED, MESSAGE_LIMIT - 1);
}
