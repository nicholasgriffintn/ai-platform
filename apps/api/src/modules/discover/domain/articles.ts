import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";

export function attachDiscoverArticles(
  cards: readonly DiscoverCard[],
  sourceIdByUrl: ReadonlyMap<string, string>,
): DiscoverCard[] {
  return cards.map((card) => {
    if (card.kind !== "read" || card.sourceId) {
      return card;
    }

    const url = comparableHttpUrl(card.url);
    const sourceId = url ? sourceIdByUrl.get(url) : undefined;

    return sourceId ? { ...card, sourceId } : card;
  });
}
