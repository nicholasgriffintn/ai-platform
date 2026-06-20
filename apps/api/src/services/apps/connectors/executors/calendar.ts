import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

export async function executeCalendarOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "list_events") {
		const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
		url.searchParams.set("singleEvents", "true");
		url.searchParams.set("orderBy", "startTime");
		url.searchParams.set(
			"maxResults",
			String(limitPositiveInteger(getNumberParam(params, "maxResults"), 10, 25)),
		);
		url.searchParams.set("timeMin", getStringParam(params, "timeMin") ?? new Date().toISOString());
		const timeMax = getStringParam(params, "timeMax");
		if (timeMax) {
			url.searchParams.set("timeMax", timeMax);
		}
		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "create_event") {
		const summary = getStringParam(params, "summary");
		const start = getStringParam(params, "start");
		const end = getStringParam(params, "end");
		if (!summary || !start || !end) {
			throw new AssistantError("summary, start, and end are required", ErrorType.PARAMS_ERROR, 400);
		}
		const timeZone = getStringParam(params, "timeZone");
		return fetchConnectorJson({
			url: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
			token,
			method: "POST",
			body: {
				summary,
				description: getStringParam(params, "description"),
				start: { dateTime: start, timeZone },
				end: { dateTime: end, timeZone },
			},
		});
	}

	throw new AssistantError("Unsupported Google Calendar operation", ErrorType.PARAMS_ERROR, 400);
}
