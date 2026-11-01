import {
  DISCOVER_FEED_LIMIT,
  RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY,
  discoverEpisodeLengthSchema,
  videoOverviewStyleSchema,
  type DiscoverSettings,
  type RecipeConfiguration,
  type UpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";
import { readCountryCode, readStringArray } from "@ngriffin_uk/polychat-utility-core";

import { DISCOVER_NEWS_CATEGORIES } from "./news-categories";

export type DiscoverPreferences = Pick<
  DiscoverSettings,
  "curate" | "listen" | "evening" | "episode" | "style" | "feeds"
> & {
  [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: string[];
  includedProviders: string[];
  newsCategories: string[];
  country: string | null;
};

type DiscoverSourcePreferences = Pick<
  DiscoverPreferences,
  typeof RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY | "includedProviders"
>;

export const DEFAULT_DISCOVER_PREFERENCES: DiscoverPreferences = {
  curate: "",
  listen: true,
  evening: false,
  episode: "standard",
  style: "watercolour",
  feeds: [],
  [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: [],
  includedProviders: [],
  newsCategories: [],
  country: null,
};

export function readDiscoverNewsCategoryIds(value: unknown): string[] {
  const ids = new Set(readStringArray(value));

  return DISCOVER_NEWS_CATEGORIES.filter((category) => ids.has(category.id)).map(
    (category) => category.id,
  );
}

export function readDiscoverPreferences(configuration: RecipeConfiguration): DiscoverPreferences {
  const episode = discoverEpisodeLengthSchema.safeParse(configuration.episode);
  const style = videoOverviewStyleSchema.safeParse(configuration.style);

  return {
    curate:
      typeof configuration.curate === "string"
        ? configuration.curate
        : DEFAULT_DISCOVER_PREFERENCES.curate,
    listen:
      typeof configuration.listen === "boolean"
        ? configuration.listen
        : DEFAULT_DISCOVER_PREFERENCES.listen,
    evening:
      typeof configuration.evening === "boolean"
        ? configuration.evening
        : DEFAULT_DISCOVER_PREFERENCES.evening,
    episode: episode.success ? episode.data : DEFAULT_DISCOVER_PREFERENCES.episode,
    style: style.success ? style.data : DEFAULT_DISCOVER_PREFERENCES.style,
    [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: Array.isArray(
      configuration[RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY],
    )
      ? configuration[RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]
      : [],
    includedProviders: readStringArray(configuration.includedProviders),
    feeds: readStringArray(configuration.feeds).slice(0, DISCOVER_FEED_LIMIT),
    newsCategories: readDiscoverNewsCategoryIds(configuration.newsCategories),
    country: readCountryCode(configuration.country),
  };
}

export function applyDiscoverSourceChange(
  current: DiscoverSourcePreferences,
  change: UpdateDiscoverSettings["source"],
  isOptIn: (providerId: string) => boolean,
): DiscoverSourcePreferences {
  if (!change) {
    return {
      [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: current[RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY],
      includedProviders: current.includedProviders,
    };
  }

  const without = (providerIds: readonly string[]) =>
    providerIds.filter((providerId) => providerId !== change.providerId);
  const excluded = without(current[RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]);
  const included = without(current.includedProviders);

  if (isOptIn(change.providerId)) {
    return {
      [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: excluded,
      includedProviders: change.used ? [...included, change.providerId] : included,
    };
  }

  return {
    [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: change.used
      ? excluded
      : [...excluded, change.providerId],
    includedProviders: included,
  };
}
