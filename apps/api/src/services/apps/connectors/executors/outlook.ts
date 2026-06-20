import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam, limitPositiveInteger } from "./params";

export async function executeOutlookOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "search_messages") {
		const query = getStringParam(params, "query");
		const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
		url.searchParams.set(
			"$top",
			String(limitPositiveInteger(getNumberParam(params, "maxResults"), 10, 25)),
		);
		url.searchParams.set("$select", "id,subject,from,receivedDateTime,webLink,bodyPreview");
		if (query) {
			const escapedQuery = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
			url.searchParams.set("$search", `"${escapedQuery}"`);
		}
		return fetchConnectorJson({
			url: url.toString(),
			token,
			headers: query ? { ConsistencyLevel: "eventual" } : undefined,
		});
	}

	if (operation === "create_draft") {
		const to = getStringParam(params, "to");
		const subject = getStringParam(params, "subject");
		const body = getStringParam(params, "body");
		if (!to || !subject || !body) {
			throw new AssistantError("to, subject, and body are required", ErrorType.PARAMS_ERROR, 400);
		}
		return fetchConnectorJson({
			url: "https://graph.microsoft.com/v1.0/me/messages",
			token,
			method: "POST",
			body: {
				subject,
				body: { contentType: "Text", content: body },
				toRecipients: [{ emailAddress: { address: to } }],
			},
		});
	}

	if (operation === "list_events") {
		const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
		url.searchParams.set(
			"$top",
			String(limitPositiveInteger(getNumberParam(params, "maxResults"), 10, 25)),
		);
		url.searchParams.set("$select", "id,subject,start,end,location,organizer,webLink,isAllDay");
		url.searchParams.set("$orderby", "start/dateTime");
		url.searchParams.set(
			"startDateTime",
			getStringParam(params, "timeMin") ?? new Date().toISOString(),
		);
		const timeMax = getStringParam(params, "timeMax");
		if (timeMax) {
			url.searchParams.set("endDateTime", timeMax);
		} else {
			const defaultEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
			url.searchParams.set("endDateTime", defaultEnd);
		}

		return fetchConnectorJson({ url: url.toString(), token });
	}

	if (operation === "create_calendar_event") {
		const subject = getStringParam(params, "summary") ?? getStringParam(params, "subject");
		const start = getStringParam(params, "start");
		const end = getStringParam(params, "end");
		if (!subject || !start || !end) {
			throw new AssistantError("summary, start, and end are required", ErrorType.PARAMS_ERROR, 400);
		}
		const timeZone = getStringParam(params, "timeZone") ?? "UTC";
		return fetchConnectorJson({
			url: "https://graph.microsoft.com/v1.0/me/events",
			token,
			method: "POST",
			body: {
				subject,
				body: { contentType: "Text", content: getStringParam(params, "description") ?? "" },
				start: { dateTime: start, timeZone },
				end: { dateTime: end, timeZone },
			},
		});
	}

	throw new AssistantError("Unsupported Outlook operation", ErrorType.PARAMS_ERROR, 400);
}
