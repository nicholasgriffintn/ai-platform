import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { createConnectorJsonClient } from "./http.js";

const fetchTflJson = createConnectorJsonClient("https://api.tfl.gov.uk");
const journeyParamsSchema = z.object({
  from: z.string().trim().min(1).max(160),
  to: z.string().trim().min(1).max(160),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
});
const RAIL_MODES = "tube,elizabeth-line,dlr,overground,tram";
const lineStatusParamsSchema = z.object({
  lines: z
    .array(z.string().regex(/^[a-z][a-z-]{1,39}$/u))
    .max(20)
    .optional(),
});
const nearbyLinesParamsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().int().min(100).max(2000).default(1000),
});

export async function executeTflOperation(
  token: string,
  operation: string,
  params: Record<string, unknown>,
) {
  const query = new URLSearchParams();

  if (token) {
    query.set("app_key", token);
  }

  if (operation === "search_stops") {
    const search = z.object({ query: z.string().trim().min(2).max(120) }).safeParse(params);

    if (!search.success) {
      throw new AssistantError(
        "Enter a station or stop name between 2 and 120 characters",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    query.set("query", search.data.query);
    query.set("maxItems", "8");

    return fetchTflJson({ path: `/StopPoint/Search?${query}`, token: "" });
  }

  if (operation === "plan_journey") {
    const journey = journeyParamsSchema.safeParse(params);

    if (!journey.success) {
      throw new AssistantError(
        "Choose a start and destination, a date in YYYY-MM-DD format and a departure time in HH:mm format",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    query.set("date", journey.data.date.replaceAll("-", ""));
    query.set("time", journey.data.time.replace(":", ""));
    query.set("timeIs", "Departing");
    query.set("journeyPreference", "LeastTime");

    return fetchTflJson({
      path: `/Journey/JourneyResults/${encodeURIComponent(journey.data.from)}/to/${encodeURIComponent(journey.data.to)}?${query}`,
      token: "",
      additionalSuccessStatuses: [300],
    });
  }

  if (operation === "line_status") {
    const status = lineStatusParamsSchema.safeParse(params);

    if (!status.success) {
      throw new AssistantError(
        "Choose up to 20 TfL line IDs, such as northern or elizabeth",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const lines = status.data.lines?.length ? status.data.lines.join(",") : null;

    return fetchTflJson({
      path: lines ? `/Line/${lines}/Status?${query}` : `/Line/Mode/${RAIL_MODES}/Status?${query}`,
      token: "",
    });
  }

  if (operation === "nearby_lines") {
    const nearby = nearbyLinesParamsSchema.safeParse(params);

    if (!nearby.success) {
      throw new AssistantError(
        "Give a latitude, a longitude and a radius between 100 and 2000 metres",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    query.set("lat", nearby.data.latitude.toFixed(4));
    query.set("lon", nearby.data.longitude.toFixed(4));
    query.set("radius", String(nearby.data.radius));
    query.set("stopTypes", "NaptanMetroStation,NaptanRailStation");
    query.set("modes", RAIL_MODES);
    query.set("returnLines", "true");

    return fetchTflJson({ path: `/StopPoint?${query}`, token: "" });
  }

  throw new AssistantError("Unsupported TfL operation", ErrorType.PARAMS_ERROR, 400);
}
