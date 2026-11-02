import {
  DISCOVER_RECIPE_ID,
  RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY,
  type DiscoverRefreshResponse,
  type DiscoverSettings,
  type RecipeInstallation,
  type TeammateContext,
  type UpdateDiscoverSettings,
} from "@ngriffin_uk/polychat-schemas";
import { isValidTimeZone } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getUserSettings } from "~/modules/auth/application/user";
import {
  describeDeviceActivitySource,
  deviceActivityProviderId,
  listDeviceActivityProviders,
  readDeviceActivitySource,
} from "~/modules/discover/domain/device-activity";
import { DISCOVER_NEWS_CATEGORIES } from "~/modules/discover/domain/news-categories";
import { buildDiscoverScheduleTriggers } from "~/modules/discover/domain/schedules";
import {
  DEFAULT_DISCOVER_PREFERENCES,
  applyDiscoverSourceChange,
  readDiscoverNewsCategoryIds,
  readDiscoverPreferences,
  type DiscoverPreferences,
} from "~/modules/discover/domain/settings";
import {
  DISCOVER_SIGNALS,
  isDiscoverOptInProvider,
  isDiscoverPublicSignal,
} from "~/modules/discover/domain/signal-catalogue";
import { listDiscoverSignalProviders } from "~/modules/discover/domain/signal-selection";
import { DISCOVER_FEED_PROVIDER_ID } from "~/modules/discover/domain/signal-sources/feeds";
import {
  isRoutineAlwaysNotified,
  setRoutineAlwaysNotified,
} from "~/modules/poly/application/handoff-preferences";
import { requirePolyContext } from "~/modules/poly/application/poly-context";
import {
  deleteRecipeInstallation,
  getAssistantRecipe,
  installAssistantRecipe,
  invokeAssistantRecipe,
  listRecipeInstallations,
} from "~/modules/recipes/application";

import { estimateDiscoverCosts } from "./cost";
import { readDiscoverDayProfile, saveDiscoverDayProfile } from "./day-profile";
import { forgetDeviceActivity } from "./device-documents";
import { enqueueDiscoverJob } from "./jobs";
import { listDiscoverSignalDocuments } from "./notebook";

function describeNewsCategories(selected: readonly string[]): DiscoverSettings["newsCategories"] {
  return DISCOVER_NEWS_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    sources: category.feeds.map((feed) => feed.name),
    selected: selected.includes(category.id),
  }));
}

const DISABLED: DiscoverSettings = {
  enabled: false,
  timezone: null,
  curate: DEFAULT_DISCOVER_PREFERENCES.curate,
  location: null,
  listen: DEFAULT_DISCOVER_PREFERENCES.listen,
  evening: DEFAULT_DISCOVER_PREFERENCES.evening,
  episode: DEFAULT_DISCOVER_PREFERENCES.episode,
  style: DEFAULT_DISCOVER_PREFERENCES.style,
  notify: false,
  feeds: [],
  newsCategories: describeNewsCategories([]),
  sources: [],
  installationId: null,
  episodeCosts: null,
};

async function findDiscoverInstallation(
  context: ServiceContext,
  polyContext: TeammateContext,
): Promise<RecipeInstallation | null> {
  const { installations } = await listRecipeInstallations({
    context,
    userId: context.requireUser().id,
  });

  return (
    installations.find(
      (installation) =>
        installation.recipeId === DISCOVER_RECIPE_ID &&
        installation.teammateContextId === polyContext.id,
    ) ?? null
  );
}

function storedPreferences(installation: RecipeInstallation): DiscoverPreferences {
  return readDiscoverPreferences(installation.configuration);
}

async function describeSources(
  context: ServiceContext,
  preferences: DiscoverPreferences,
): Promise<DiscoverSettings["sources"]> {
  const excluded = preferences[RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY];
  const user = context.requireUser();
  const [recipe, signals] = await Promise.all([
    getAssistantRecipe(DISCOVER_RECIPE_ID, { context, userId: user.id }),
    listDiscoverSignalDocuments(context, user.id),
  ]);

  const health = (providerId: string) => {
    const read = signals.filter((document) => document.providerId === providerId);

    return {
      used: !excluded.includes(providerId),
      lastReadAt:
        read
          .map((document) => document.readAt)
          .filter((value): value is string => value !== null)
          .sort()
          .at(-1) ?? null,
      lastError: read.find((document) => document.error)?.error ?? null,
    };
  };

  const devices = listDeviceActivityProviders(
    signals.map((document) => document.providerId),
    excluded,
  );

  return [
    ...(recipe?.integrations ?? []).map((integration) => ({
      providerId: integration.providerId,
      name: integration.name,
      description: integration.description,
      connected: integration.connectionStatus === "connected",
      ...health(integration.providerId),
    })),
    ...devices.map((source) => ({
      providerId: deviceActivityProviderId(source),
      ...describeDeviceActivitySource(source),
      connected: true,
      ...health(deviceActivityProviderId(source)),
    })),
    ...listDiscoverSignalProviders(DISCOVER_SIGNALS.filter(isDiscoverPublicSignal)).map(
      (source) => ({
        providerId: source.providerId,
        name: source.title,
        description: source.description,
        connected: true,
        ...health(source.providerId),
        used: preferences.includedProviders.includes(source.providerId),
      }),
    ),
    ...(preferences.feeds.length > 0
      ? [
          {
            providerId: DISCOVER_FEED_PROVIDER_ID,
            name: "Your feeds",
            description: `Reads the ${preferences.feeds.length} feeds you follow.`,
            connected: true,
            ...health(DISCOVER_FEED_PROVIDER_ID),
          },
        ]
      : []),
  ];
}

export type DiscoverRoutineSettings = Omit<
  DiscoverSettings,
  "notify" | "sources" | "episodeCosts"
> & {
  excludedProviders: string[];
  includedProviders: string[];
  newsCategoryIds: string[];
  country: string | null;
};

function describeRoutine(
  installation: RecipeInstallation | null,
  location: string | null,
): DiscoverRoutineSettings {
  if (!installation) {
    return {
      ...DISABLED,
      location,
      excludedProviders: [],
      includedProviders: [],
      newsCategoryIds: [],
      country: null,
    };
  }

  const schedule = installation.triggers.find((trigger) => trigger.type === "schedule");
  const preferences = storedPreferences(installation);

  return {
    enabled: installation.status === "active",
    timezone: schedule?.timezone ?? null,
    curate: preferences.curate,
    location,
    listen: preferences.listen,
    evening: preferences.evening,
    episode: preferences.episode,
    style: preferences.style,
    feeds: preferences.feeds,
    newsCategories: describeNewsCategories(preferences.newsCategories),
    newsCategoryIds: preferences.newsCategories,
    installationId: installation.id,
    excludedProviders: preferences[RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY],
    includedProviders: preferences.includedProviders,
    country: preferences.country,
  };
}

async function describeInstallation(
  context: ServiceContext,
  installation: RecipeInstallation | null,
): Promise<DiscoverSettings> {
  if (!installation) {
    return DISABLED;
  }

  const preferences = storedPreferences(installation);
  const [location, notify, costs, sources] = await Promise.all([
    readUserLocation(context),
    isRoutineAlwaysNotified(context, installation.id),
    estimateDiscoverCosts(context),
    describeSources(context, preferences),
  ]);
  const {
    excludedProviders: _excluded,
    includedProviders: _included,
    newsCategoryIds: _newsCategoryIds,
    ...routine
  } = describeRoutine(installation, location);

  return { ...routine, notify, episodeCosts: costs.episode, sources };
}

async function readUserLocation(context: ServiceContext): Promise<string | null> {
  const user = context.requireUser();
  const settings = await getUserSettings(context.repositories, user.id);

  return settings?.location?.trim() || user.location?.trim() || null;
}

export async function readDiscoverRoutine(
  context: ServiceContext,
): Promise<DiscoverRoutineSettings> {
  const polyContext = await requirePolyContext(context);

  return describeRoutine(
    await findDiscoverInstallation(context, polyContext),
    await readUserLocation(context),
  );
}

export async function readDiscoverSettings(context: ServiceContext): Promise<DiscoverSettings> {
  const polyContext = await requirePolyContext(context);

  return describeInstallation(context, await findDiscoverInstallation(context, polyContext));
}

export async function updateDiscoverSettings(
  context: ServiceContext,
  input: UpdateDiscoverSettings,
  requestCountry: string | null,
): Promise<DiscoverSettings> {
  const user = context.requireUser();
  const polyContext = await requirePolyContext(context);
  const existing = await findDiscoverInstallation(context, polyContext);

  if (!input.enabled) {
    if (existing) {
      await deleteRecipeInstallation({ context, userId: user.id, installationId: existing.id });
    }

    return DISABLED;
  }

  const current = existing ? storedPreferences(existing) : DEFAULT_DISCOVER_PREFERENCES;
  const currentTimezone =
    existing?.triggers.find((trigger) => trigger.type === "schedule")?.timezone ?? null;
  let profile = await readDiscoverDayProfile(context);
  const timezone =
    input.timezone && isValidTimeZone(input.timezone)
      ? input.timezone
      : profile.revision > 0
        ? profile.timezone
        : (currentTimezone ?? "UTC");
  const preferences: DiscoverPreferences = {
    curate: input.curate ?? current.curate,
    listen: input.listen ?? current.listen,
    evening: input.evening ?? current.evening,
    episode: input.episode ?? current.episode,
    style: input.style ?? current.style,
    feeds: input.feeds ? [...new Set(input.feeds)] : current.feeds,
    newsCategories: input.newsCategories
      ? readDiscoverNewsCategoryIds(input.newsCategories)
      : current.newsCategories,
    ...applyDiscoverSourceChange(current, input.source, isDiscoverOptInProvider),
    country: requestCountry ?? current.country,
  };

  if (profile.timezone !== timezone) {
    profile = await saveDiscoverDayProfile(context, {
      expectedRevision: profile.revision,
      timezone,
    });
  }

  const installed = await installAssistantRecipe(DISCOVER_RECIPE_ID, {
    context,
    userId: user.id,
    channel: "web",
    teammateContextId: polyContext.id,
    triggers: buildDiscoverScheduleTriggers(profile, preferences),
    configuration: preferences,
  });

  if (!installed) {
    throw new AssistantError("Discover is not available yet", ErrorType.NOT_FOUND, 404);
  }

  if (input.source && !input.source.used && readDeviceActivitySource(input.source.providerId)) {
    await forgetDeviceActivity(context, { providerId: input.source.providerId });
  }

  const reinstalled = await findDiscoverInstallation(context, polyContext);

  if (reinstalled && input.notify !== undefined) {
    await setRoutineAlwaysNotified(context, {
      installationId: reinstalled.id,
      title: "Discover",
      enabled: input.notify,
    });
  }

  await enqueueDiscoverJob(context, { job: "gather" });

  return describeInstallation(context, reinstalled);
}

export async function refreshDiscoverEdition(
  context: ServiceContext,
): Promise<DiscoverRefreshResponse> {
  const user = context.requireUser();
  const polyContext = await requirePolyContext(context);
  const installation = await findDiscoverInstallation(context, polyContext);

  if (!installation) {
    return { status: "not_enabled", taskId: null };
  }

  const invocation = await invokeAssistantRecipe(DISCOVER_RECIPE_ID, {
    context,
    userId: user.id,
    channel: "web",
    queue: true,
    requireInstalled: true,
    installationId: installation.id,
  });

  if (!invocation || invocation.status === "not_installed") {
    return { status: "not_enabled", taskId: null };
  }

  if (invocation.status === "paused" || invocation.status === "blocked") {
    return { status: invocation.status, taskId: null };
  }

  return { status: "queued", taskId: invocation.taskId ?? null };
}
