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

  throw new AssistantError("Unsupported TfL operation", ErrorType.PARAMS_ERROR, 400);
}
