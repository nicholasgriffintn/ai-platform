import type { DiscoverCard, DiscoverDayContext } from "@ngriffin_uk/polychat-schemas";

import { discoverTopicKey } from "./edition";
import { discoverCardIdentity } from "./live";

export function rankDiscoverDayCards<T extends { card: DiscoverCard }>(
  cards: readonly T[],
  input: {
    day: DiscoverDayContext;
    topics: ReadonlySet<string>;
    saved: ReadonlySet<string>;
    work: ReadonlySet<string>;
  },
): T[] {
  const weight = (card: DiscoverCard) => {
    const key = discoverCardIdentity(card);
    const followed = "topic" in card && input.topics.has(discoverTopicKey(card.topic));
    const working = input.day.working && input.day.moment !== "lunch";

    return (
      (followed ? 4 : 0) +
      (input.saved.has(key) && (input.day.moment === "lunch" || input.day.mode === "off") ? 6 : 0) +
      (input.work.has(key) ? (working ? 4 : input.day.mode === "off" ? -4 : 0) : 0) +
      (card.kind === "wind_down" && input.day.moment === "evening" ? 5 : 0)
    );
  };

  return [...cards].sort((left, right) => weight(right.card) - weight(left.card));
}
