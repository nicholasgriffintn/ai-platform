const RERUN_SUFFIX = ":rerun";
const LEASE_POLL_SECONDS = 60;
const RERUN_DELAY_SECONDS = 1;

export function chooseRecipeOccurrenceCommandId(
  commandId: string,
  previousRunStatus: string | undefined,
): string {
  return previousRunStatus === "interrupted" ? `${commandId}${RERUN_SUFFIX}` : commandId;
}

export function readRecipeOccurrenceRetryDelay(input: {
  commandId: string | undefined;
  runStatus: string | undefined;
  replayed: boolean;
}): number | null {
  if (input.runStatus === "interrupted") {
    return input.commandId && !input.commandId.endsWith(RERUN_SUFFIX) ? RERUN_DELAY_SECONDS : null;
  }

  return input.replayed && (input.runStatus === "accepted" || input.runStatus === "running")
    ? LEASE_POLL_SECONDS
    : null;
}
