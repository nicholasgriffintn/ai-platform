import {
  RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY,
  discoverEpisodeLengthSchema,
  videoOverviewStyleSchema,
  type DiscoverSettings,
  type RecipeConfiguration,
} from "@ngriffin_uk/polychat-schemas";

export type DiscoverPreferences = Pick<
  DiscoverSettings,
  "curate" | "listen" | "evening" | "episode" | "style"
> & { [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: string[] };

export const DEFAULT_DISCOVER_PREFERENCES: DiscoverPreferences = {
  curate: "",
  listen: true,
  evening: false,
  episode: "standard",
  style: "watercolour",
  [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: [],
};

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
  };
}
