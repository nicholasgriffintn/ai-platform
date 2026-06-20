import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getStringParam } from "./params";

const FITBIT_API_BASE_URL = "https://api.fitbit.com";
const FITBIT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getFitbitDate(params: Record<string, unknown>): string {
	const date = getStringParam(params, "date") ?? "today";
	if (date === "today" || FITBIT_DATE_PATTERN.test(date)) {
		return date;
	}

	throw new AssistantError("date must be today or yyyy-MM-dd", ErrorType.PARAMS_ERROR, 400);
}

export async function executeFitbitOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "profile") {
		return fetchConnectorJson({
			url: `${FITBIT_API_BASE_URL}/1/user/-/profile.json`,
			token,
		});
	}

	if (operation === "daily_activity") {
		return fetchConnectorJson({
			url: `${FITBIT_API_BASE_URL}/1/user/-/activities/date/${encodeURIComponent(
				getFitbitDate(params),
			)}.json`,
			token,
		});
	}

	if (operation === "sleep_logs") {
		return fetchConnectorJson({
			url: `${FITBIT_API_BASE_URL}/1.2/user/-/sleep/date/${encodeURIComponent(
				getFitbitDate(params),
			)}.json`,
			token,
		});
	}

	if (operation === "heart_rate") {
		return fetchConnectorJson({
			url: `${FITBIT_API_BASE_URL}/1/user/-/activities/heart/date/${encodeURIComponent(
				getFitbitDate(params),
			)}/1d.json`,
			token,
		});
	}

	throw new AssistantError("Unsupported Fitbit operation", ErrorType.PARAMS_ERROR, 400);
}
