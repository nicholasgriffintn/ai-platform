import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverResearchResult } from "../research";
import { first, joinParts, lines } from "./read";
import type { DiscoverSignal } from "./types";

function apodPicture(result: unknown): unknown {
  return isRecord(result) && isRecord(result.data) ? result.data : result;
}

function apodPageUrl(date: string): string {
  const [year, month, day] = date.split("-");

  return year && month && day
    ? `https://apod.nasa.gov/apod/ap${year.slice(2)}${month}${day}.html`
    : "https://apod.nasa.gov/apod/astropix.html";
}

function apodItems(result: unknown): DiscoverResearchResult[] {
  const picture = apodPicture(result);
  const title = first(picture, ["title"]);
  const date = first(picture, ["date"]);

  return title
    ? [
        {
          title,
          url: apodPageUrl(date),
          snippet: first(picture, ["explanation"]).slice(0, 400),
          source: joinParts("NASA", first(picture, ["copyright"])),
          date,
          ...(first(picture, ["media_type"]) === "video" ? { media: "watch" as const } : {}),
        },
      ]
    : [];
}

export const NASA_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "nasa-apod",
    providerId: "nasa",
    group: "pictures",
    title: "Astronomy picture of the day",
    description: "Reads NASA's astronomy picture of the day.",
    operation: "NASA_GET_APOD",
    parameters: () => ({}),
    items: (result) => apodItems(result),
    digest: (result) =>
      lines([apodPicture(result)], (picture) =>
        joinParts(first(picture, ["title"]), first(picture, ["date"])),
      ),
  },
];
