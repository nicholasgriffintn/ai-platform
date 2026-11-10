import {
  placeSchema,
  transitJourneySchema,
  type Place,
  type RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";
import { truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { closeComposioConnectorRun } from "./composio-run";
import { executeRecipeConnectorOperation } from "./operations";

const weatherPlacesSchema = z.object({
  data: z
    .array(
      z.object({
        name: z.string(),
        lat: z.number(),
        lon: z.number(),
        country: z.string(),
        state: z.string().nullish(),
      }),
    )
    .max(5),
});
const tflPlacesSchema = z.object({
  matches: z
    .array(z.object({ name: z.string(), lat: z.number().optional(), lon: z.number().optional() }))
    .max(100),
});
const tflJourneySchema = z.object({
  journeys: z
    .array(
      z.object({
        duration: z.number().finite().positive().max(1440),
        legs: z
          .array(
            z.object({
              disruptions: z
                .array(
                  z.object({ description: z.string().optional(), summary: z.string().optional() }),
                )
                .optional(),
            }),
          )
          .default([]),
      }),
    )
    .max(20),
});

const tflLineStatusSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(60),
      name: z.string().min(1).max(120),
      lineStatuses: z
        .array(
          z.object({
            statusSeverity: z.number().int(),
            statusSeverityDescription: z.string().max(120),
            reason: z.string().nullish(),
          }),
        )
        .default([]),
    }),
  )
  .max(80);
const tflNearbyLinesSchema = z.object({
  stopPoints: z
    .array(
      z.object({
        distance: z.number().optional(),
        lines: z.array(z.object({ id: z.string().min(1).max(60) })).default([]),
      }),
    )
    .max(200),
});

export interface TransitLineStatus {
  id: string;
  name: string;
  statuses: { severity: number; description: string; reason: string | null }[];
}

export async function searchConnectorPlaces(
  context: ServiceContext,
  provider: RecipeConnectorProvider,
  query: string,
): Promise<{ places: Place[] }> {
  const user = context.requireUser();

  if (provider !== "openweather_api" && provider !== "tfl") {
    throw new AssistantError(
      "This connector does not support place search",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  try {
    const response = await executeRecipeConnectorOperation({
      context,
      userId: user.id,
      request: {
        provider,
        operation:
          provider === "openweather_api" ? "OPENWEATHER_API_GET_GEOCODING_DIRECT" : "search_stops",
        params: provider === "openweather_api" ? { q: query, limit: 5 } : { query },
      },
    });
    const candidates =
      provider === "openweather_api"
        ? weatherPlacesSchema.parse(response).data.map((place) => ({
            label: truncateSingleLine(
              [place.name, place.state, place.country].filter(Boolean).join(", "),
              160,
            ),
            latitude: place.lat,
            longitude: place.lon,
          }))
        : tflPlacesSchema.parse(response).matches.map((place) => ({
            label: truncateSingleLine(place.name, 160),
            latitude: place.lat,
            longitude: place.lon,
          }));

    return {
      places: candidates
        .flatMap((candidate) => {
          const parsed = placeSchema.safeParse(candidate);

          return parsed.success ? [parsed.data] : [];
        })
        .slice(0, 8),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AssistantError(
        "The place provider returned an invalid response",
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    throw error;
  } finally {
    await closeComposioConnectorRun(context);
  }
}

export async function readConnectorJourney(
  context: ServiceContext,
  input: { origin: Place; destination: Place; date: string; departure: string },
) {
  const response = await executeRecipeConnectorOperation({
    context,
    userId: context.requireUser().id,
    request: {
      provider: "tfl",
      operation: "plan_journey",
      params: {
        from: `${input.origin.latitude},${input.origin.longitude}`,
        to: `${input.destination.latitude},${input.destination.longitude}`,
        date: input.date,
        time: input.departure,
      },
    },
  });
  const parsed = tflJourneySchema.safeParse(response);

  if (!parsed.success) {
    throw new AssistantError("TfL returned no usable journey", ErrorType.PROVIDER_ERROR, 502);
  }

  return parsed.data.journeys.map((journey) =>
    transitJourneySchema.parse({
      durationMinutes: journey.duration,
      disruptions: [
        ...new Set(
          journey.legs.flatMap((leg) =>
            (leg.disruptions ?? [])
              .map((disruption) => disruption.description ?? disruption.summary ?? "")
              .filter(Boolean),
          ),
        ),
      ],
    }),
  );
}

export async function readConnectorLineStatus(
  context: ServiceContext,
  lines: readonly string[],
): Promise<TransitLineStatus[]> {
  const response = await executeRecipeConnectorOperation({
    context,
    userId: context.requireUser().id,
    request: { provider: "tfl", operation: "line_status", params: { lines: [...lines] } },
  });
  const parsed = tflLineStatusSchema.safeParse(response);

  if (!parsed.success) {
    throw new AssistantError("TfL returned no usable line status", ErrorType.PROVIDER_ERROR, 502);
  }

  return parsed.data.map((line) => ({
    id: line.id,
    name: truncateSingleLine(line.name, 120),
    statuses: line.lineStatuses.map((status) => ({
      severity: status.statusSeverity,
      description: truncateSingleLine(status.statusSeverityDescription, 120),
      reason: status.reason ? truncateSingleLine(status.reason, 600) : null,
    })),
  }));
}

export async function readConnectorNearbyLines(
  context: ServiceContext,
  point: { latitude: number; longitude: number },
): Promise<string[]> {
  const response = await executeRecipeConnectorOperation({
    context,
    userId: context.requireUser().id,
    request: {
      provider: "tfl",
      operation: "nearby_lines",
      params: { latitude: point.latitude, longitude: point.longitude, radius: 1000 },
    },
  });
  const parsed = tflNearbyLinesSchema.safeParse(response);

  if (!parsed.success) {
    throw new AssistantError(
      "TfL returned no usable nearby stations",
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  return [
    ...new Set(
      [...parsed.data.stopPoints]
        .sort((left, right) => (left.distance ?? Infinity) - (right.distance ?? Infinity))
        .flatMap((stop) => stop.lines.map((line) => line.id)),
    ),
  ];
}
