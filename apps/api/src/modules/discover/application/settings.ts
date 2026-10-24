import {
  DISCOVER_CRON,
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
import {
  DEFAULT_DISCOVER_PREFERENCES,
  readDiscoverPreferences,
  type DiscoverPreferences,
} from "~/modules/discover/domain/settings";
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

const DISABLED: DiscoverSettings = {
  enabled: false,
  timezone: null,
  curate: DEFAULT_DISCOVER_PREFERENCES.curate,
  listen: DEFAULT_DISCOVER_PREFERENCES.listen,
  episode: DEFAULT_DISCOVER_PREFERENCES.episode,
  style: DEFAULT_DISCOVER_PREFERENCES.style,
  notify: false,
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
  excluded: readonly string[],
): Promise<DiscoverSettings["sources"]> {
  const recipe = await getAssistantRecipe(DISCOVER_RECIPE_ID, {
    context,
    userId: context.requireUser().id,
  });

  return (recipe?.integrations ?? []).map((integration) => ({
    providerId: integration.providerId,
    name: integration.name,
    description: integration.description,
    connected: integration.connectionStatus === "connected",
    used: !excluded.includes(integration.providerId),
  }));
}

export type DiscoverRoutineSettings = Omit<DiscoverSettings, "notify" | "sources" | "episodeCosts">;

function describeRoutine(installation: RecipeInstallation | null): DiscoverRoutineSettings {
  if (!installation) {
    return DISABLED;
  }

  const schedule = installation.triggers.find((trigger) => trigger.type === "schedule");
  const preferences = storedPreferences(installation);

  return {
    enabled: installation.status === "active",
    timezone: schedule?.timezone ?? null,
    curate: preferences.curate,
    listen: preferences.listen,
    episode: preferences.episode,
    style: preferences.style,
    installationId: installation.id,
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

  return {
    ...describeRoutine(installation),
    notify: await isRoutineAlwaysNotified(context, installation.id),
    episodeCosts: (await estimateDiscoverCosts(context)).episode,
    sources: await describeSources(context, preferences[RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]),
  };
}

function nextExcludedSources(
  current: readonly string[],
  change: UpdateDiscoverSettings["source"],
): string[] {
  if (!change) {
    return [...current];
  }

  const others = current.filter((providerId) => providerId !== change.providerId);

  return change.used ? others : [...others, change.providerId];
}

export async function readDiscoverRoutine(
  context: ServiceContext,
): Promise<DiscoverRoutineSettings> {
  const polyContext = await requirePolyContext(context);

  return describeRoutine(await findDiscoverInstallation(context, polyContext));
}

export async function readDiscoverSettings(context: ServiceContext): Promise<DiscoverSettings> {
  const polyContext = await requirePolyContext(context);

  return describeInstallation(context, await findDiscoverInstallation(context, polyContext));
}

export async function updateDiscoverSettings(
  context: ServiceContext,
  input: UpdateDiscoverSettings,
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
  const timezone =
    input.timezone && isValidTimeZone(input.timezone) ? input.timezone : (currentTimezone ?? "UTC");
  const preferences: DiscoverPreferences = {
    curate: input.curate ?? current.curate,
    listen: input.listen ?? current.listen,
    episode: input.episode ?? current.episode,
    style: input.style ?? current.style,
    [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: nextExcludedSources(
      current[RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY],
      input.source,
    ),
  };
  const installed = await installAssistantRecipe(DISCOVER_RECIPE_ID, {
    context,
    userId: user.id,
    channel: "web",
    teammateContextId: polyContext.id,
    triggers: [{ type: "schedule", enabled: true, cronExpression: DISCOVER_CRON, timezone }],
    configuration: preferences,
  });

  if (!installed) {
    throw new AssistantError("Discover is not available yet", ErrorType.NOT_FOUND, 404);
  }

  const reinstalled = await findDiscoverInstallation(context, polyContext);

  if (reinstalled && input.notify !== undefined) {
    await setRoutineAlwaysNotified(context, {
      installationId: reinstalled.id,
      title: "Discover",
      enabled: input.notify,
    });
  }

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
