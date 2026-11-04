import {
  isRecord,
  readArray,
  readFiniteNumber,
  readNonEmptyString,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { MediaType } from "~/modules/watching/domain/titles";

const JUSTWATCH_URL = "https://apis.justwatch.com/graphql";
const JUSTWATCH_TIMEOUT_MS = 12_000;
const SEARCH_RESULTS = 10;
const OFFERS_QUERY = `query TitleOffers($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter, $platform: Platform!) {
  popularTitles(country: $country, first: $first, filter: $filter) {
    edges {
      node {
        content(country: $country, language: $language) { externalIds { tmdbId } }
        offers(country: $country, platform: $platform) {
          monetizationType
          presentationType
          standardWebURL
          retailPrice(language: $language)
          package { clearName }
        }
      }
    }
  }
}`;

export interface WatchOffer {
  service: string;
  type: string;
  quality: string | null;
  price: string | null;
  url: string;
}

function readOffer(value: unknown): WatchOffer | null {
  if (!isRecord(value) || !isRecord(value.package)) {
    return null;
  }

  const service = readNonEmptyString(value.package.clearName);
  const type = readNonEmptyString(value.monetizationType);
  const url = readNonEmptyString(value.standardWebURL);

  return service && type && url
    ? {
        service,
        type: type.toLowerCase(),
        quality: readNonEmptyString(value.presentationType) ?? null,
        price: readNonEmptyString(value.retailPrice) ?? null,
        url,
      }
    : null;
}

function readTmdbId(node: Record<string, unknown>): number | null {
  const content = isRecord(node.content) ? node.content : {};
  const ids = isRecord(content.externalIds) ? content.externalIds : {};

  return readFiniteNumber(Number(ids.tmdbId)) ?? null;
}

export async function fetchWatchOffers(input: {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  region: string;
}): Promise<WatchOffer[]> {
  const response = await fetch(JUSTWATCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "TitleOffers",
      query: OFFERS_QUERY,
      variables: {
        country: input.region,
        language: "en",
        first: SEARCH_RESULTS,
        platform: "WEB",
        filter: {
          searchQuery: input.title,
          objectTypes: [input.mediaType === "movie" ? "MOVIE" : "SHOW"],
        },
      },
    }),
    signal: AbortSignal.timeout(JUSTWATCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `JustWatch answered with ${response.status}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const payload: unknown = await response.json();
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
  const titles = isRecord(data.popularTitles) ? data.popularTitles : {};
  const match = readArray(titles.edges)
    .flatMap((edge) => (isRecord(edge) && isRecord(edge.node) ? [edge.node] : []))
    .find((node) => readTmdbId(node) === input.tmdbId);

  return readArray(match?.offers).flatMap((offer) => readOffer(offer) ?? []);
}
