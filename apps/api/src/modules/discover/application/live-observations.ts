import type {
  DiscoverDayProfile,
  DiscoverDeviceLocation,
  DiscoverObservation,
  DiscoverPlace,
} from "@ngriffin_uk/polychat-schemas";
import {
  describeZonedInstant,
  haversineKm,
  sha256Hex,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { closeComposioConnectorRun } from "~/modules/connectors/application/composio-run";
import { readConnectorJourney } from "~/modules/connectors/application/places";
import { readConnectorWeather } from "~/modules/connectors/application/weather";
import {
  describeDiscoverCommute,
  discoverCommuteMaterial,
} from "~/modules/discover/domain/commute";
import { discoverCommuteWindow, resolveDiscoverDay } from "~/modules/discover/domain/day";
import { findDiscoverSignal } from "~/modules/discover/domain/signal-catalogue";

import { readSignal, resolveDiscoverSignals } from "./gather";
import { ensureDiscoverNotebook, listDiscoverDocuments } from "./notebook";
import type { DiscoverRoutineSettings } from "./settings";

const NEARBY_WEATHER_KM = 10;

function resolveDiscoverWeatherPlace(
  saved: DiscoverPlace | null,
  location: DiscoverDeviceLocation | null,
): { place: DiscoverPlace; title: string } | null {
  if (
    location &&
    (!saved ||
      haversineKm(
        { lat: saved.latitude, lng: saved.longitude },
        { lat: location.latitude, lng: location.longitude },
      ) >= NEARBY_WEATHER_KM)
  ) {
    return {
      place: { label: "Near you", latitude: location.latitude, longitude: location.longitude },
      title: "Weather near you",
    };
  }

  return saved ? { place: saved, title: `Weather in ${saved.label}` } : null;
}

async function readDiscoverWeather(
  context: ServiceContext,
  target: { place: DiscoverPlace; title: string },
  now: Date,
): Promise<DiscoverObservation> {
  const { place, title } = target;
  const weather = await readConnectorWeather(context, place);
  const condition = weather.weather[0];
  const observedAt = new Date(weather.dt * 1000);

  if (observedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new Error("Weather returned a future observation");
  }

  return {
    id: "weather",
    kind: "weather",
    title,
    text: `${Math.round(weather.main.temp)}°C, ${condition?.description ?? "conditions unavailable"}.`,
    source: "OpenWeather",
    providerId: "openweather_api",
    href: "https://openweathermap.org/",
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(observedAt.getTime() + 60 * 60 * 1000).toISOString(),
    actionable:
      (condition?.id ?? 800) < 300 || weather.main.temp >= 30 || (weather.wind?.speed ?? 0) >= 15,
    fingerprint: await sha256Hex(
      `${condition?.id}:${Math.floor(weather.main.temp / 2)}:${Math.floor((weather.wind?.speed ?? 0) / 5)}`,
    ),
    stale: false,
  };
}

export async function gatherDiscoverObservations(
  context: ServiceContext,
  profile: DiscoverDayProfile,
  settings: DiscoverRoutineSettings,
  previous: readonly DiscoverObservation[],
  now: Date,
  location: DiscoverDeviceLocation | null = null,
): Promise<DiscoverObservation[]> {
  const weatherTarget = resolveDiscoverWeatherPlace(profile.weatherLocation, location);
  const user = context.requireUser();
  const day = resolveDiscoverDay(profile, now);
  const local = describeZonedInstant(now, profile.timezone);
  const documents = await listDiscoverDocuments(context, user.id);
  const { selected } = await resolveDiscoverSignals(context, settings);
  const due = selected
    .filter((signal) => ["calendar", "tasks", "places"].includes(signal.group))
    .filter((signal) => signal.id !== "openweather-today" || !weatherTarget)
    .filter((signal) => {
      const document = documents.signals.find((candidate) => candidate.signalId === signal.id);
      const last = document?.attemptedAt ?? document?.readAt;

      return (
        !last ||
        document?.date !== local.date ||
        document.timezone !== profile.timezone ||
        now.getTime() - Date.parse(last) >= 15 * 60 * 1000
      );
    });

  if (due.length > 0) {
    const notebook = await ensureDiscoverNotebook(context);

    for (const signal of due) {
      try {
        await readSignal(context, notebook.id, signal, {
          date: local.date,
          timezone: profile.timezone,
          now,
          location: settings.location,
          topics: profile.topics,
        });
      } finally {
        await closeComposioConnectorRun(context);
      }
    }
  }

  const fresh = due.length > 0 ? await listDiscoverDocuments(context, user.id) : documents;
  const observations: DiscoverObservation[] = [];

  for (const document of fresh.signals) {
    const signal = findDiscoverSignal(document.signalId);

    if (
      !signal ||
      !selected.some((candidate) => candidate.id === signal.id) ||
      !["calendar", "tasks", "places"].includes(signal.group) ||
      (signal.id === "openweather-today" && weatherTarget) ||
      !document.readAt
    ) {
      continue;
    }

    if (document.date !== local.date || document.timezone !== profile.timezone) {
      continue;
    }

    const kind =
      signal.group === "calendar" ? "calendar" : signal.group === "tasks" ? "task" : "weather";
    const lifetime = kind === "weather" ? 60 * 60 * 1000 : 30 * 60 * 1000;

    for (const line of document.lines.slice(0, 3)) {
      const fingerprint = await sha256Hex(line);

      observations.push({
        id: `${signal.id}:${fingerprint.slice(0, 16)}`,
        kind,
        title: document.title,
        text: truncateSingleLine(line, 1000),
        source: document.title,
        providerId: signal.providerId,
        observedAt: document.readAt,
        expiresAt: new Date(Date.parse(document.readAt) + lifetime).toISOString(),
        actionable: false,
        fingerprint,
        stale: document.error !== null,
      });
    }
  }

  if (weatherTarget && !settings.excludedProviders.includes("openweather_api")) {
    const cached = previous.find(
      (observation) =>
        observation.id === "weather" &&
        observation.title === weatherTarget.title &&
        observation.expiresAt > now.toISOString(),
    );

    try {
      observations.push(cached ?? (await readDiscoverWeather(context, weatherTarget, now)));
    } catch {
      const stale = previous.find(
        (observation) => observation.id === "weather" && observation.title === weatherTarget.title,
      );

      if (stale) {
        observations.push({ ...stale, stale: true });
      }
    }
  }

  const commute = discoverCommuteWindow(profile, day, now);

  if (commute && profile.commute && !settings.excludedProviders.includes("tfl")) {
    const id = `travel:${day.date}:${commute.direction}`;
    const cached = previous.find((observation) => observation.id === id);

    try {
      if (cached && cached.expiresAt > now.toISOString()) {
        observations.push(cached);
      } else {
        const route = profile.commute;
        const response = await readConnectorJourney(context, {
          origin: commute.direction === "outbound" ? route.origin : route.destination,
          destination: commute.direction === "outbound" ? route.destination : route.origin,
          date: day.date,
          departure: commute.departure,
        });
        const observation = describeDiscoverCommute(response, {
          ...commute,
          date: day.date,
          now,
          alertDelayMinutes: route.alertDelayMinutes,
          baselineMinutes: cached?.journey?.baselineMinutes,
          fingerprint: await sha256Hex(
            discoverCommuteMaterial(response, {
              baselineMinutes: cached?.journey?.baselineMinutes,
              alertDelayMinutes: route.alertDelayMinutes,
            }),
          ),
        });

        if (observation) {
          observations.push(observation);
        }
      }
    } catch {
      if (cached) {
        observations.push({ ...cached, stale: true });
      }
    }
  }

  return observations.slice(0, 16);
}
