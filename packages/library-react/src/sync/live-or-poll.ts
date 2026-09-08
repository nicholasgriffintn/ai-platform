import { useSyncStore } from "@ngriffin_uk/polychat-library-client";

export type PollInterval = number | false | undefined;

export function liveOrPoll<TQuery>(
  query: TQuery,
  interval: PollInterval | ((query: TQuery) => PollInterval),
): PollInterval {
  if (useSyncStore.getState().status === "open") {
    return false;
  }

  return typeof interval === "function" ? interval(query) : interval;
}
