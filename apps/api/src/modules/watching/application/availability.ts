import { fetchTitleBackground, fetchTmdbTitle } from "@ngriffin_uk/polychat-ai-integrations";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { TitleRef } from "~/modules/watching/domain/titles";
import { fetchWatchOffers } from "~/modules/watching/infrastructure/justwatch-client";
import {
  fetchTrailers,
  type TrailerFeed,
} from "~/modules/watching/infrastructure/kinocheck-client";

import { requireTitleRef, requireTmdbToken } from "./catalogue";

export async function readWatchOffers(context: ServiceContext, titleId: string, region: string) {
  const ref = requireTitleRef(titleId);
  const details = await fetchTmdbTitle(requireTmdbToken(context), ref, region);

  return fetchWatchOffers({ ...ref, title: details.title, region });
}

export function readTrailers(context: ServiceContext, feed: TrailerFeed) {
  return fetchTrailers(context.env.KINOCHECK_API_KEY, feed);
}

export function readTitleBackground(ref: TitleRef) {
  return fetchTitleBackground(ref);
}
