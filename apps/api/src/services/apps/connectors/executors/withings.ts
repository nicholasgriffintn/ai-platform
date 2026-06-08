import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { fetchConnectorJson } from "./http";
import { getNumberParam, getStringParam } from "./params";

const WITHINGS_API_BASE_URL = "https://wbsapi.withings.net";
const WITHINGS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getWithingsDate(params: Record<string, unknown>, key: string): string | undefined {
	const date = getStringParam(params, key);
	if (!date) {
		return undefined;
	}
	if (WITHINGS_DATE_PATTERN.test(date)) {
		return date;
	}

	throw new AssistantError(`${key} must be yyyy-MM-dd`, ErrorType.PARAMS_ERROR, 400);
}

function addDateRange(url: URL, params: Record<string, unknown>) {
	const startDate = getWithingsDate(params, "startDate");
	const endDate = getWithingsDate(params, "endDate") ?? startDate;
	if (startDate) {
		url.searchParams.set("startdateymd", startDate);
	}
	if (endDate) {
		url.searchParams.set("enddateymd", endDate);
	}
}

function addTimestampRange(url: URL, params: Record<string, unknown>) {
	const startTimestamp = getNumberParam(params, "startTimestamp");
	const endTimestamp = getNumberParam(params, "endTimestamp");
	if (startTimestamp !== undefined) {
		url.searchParams.set("startdate", String(Math.floor(startTimestamp)));
	}
	if (endTimestamp !== undefined) {
		url.searchParams.set("enddate", String(Math.floor(endTimestamp)));
	}
}

async function fetchWithingsJson(params: { url: string; token: string }) {
	const data = await fetchConnectorJson(params);
	if (isRecord(data) && typeof data.status === "number" && data.status !== 0) {
		throw new AssistantError(
			`Withings API request failed with status ${data.status}`,
			ErrorType.EXTERNAL_API_ERROR,
			502,
		);
	}

	return data;
}

export async function executeWithingsOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	if (operation === "profile") {
		return fetchWithingsJson({
			url: `${WITHINGS_API_BASE_URL}/v2/user?action=get`,
			token,
		});
	}

	if (operation === "devices") {
		return fetchWithingsJson({
			url: `${WITHINGS_API_BASE_URL}/v2/user?action=getdevice`,
			token,
		});
	}

	if (operation === "measurements") {
		const url = new URL(`${WITHINGS_API_BASE_URL}/measure`);
		url.searchParams.set("action", "getmeas");
		addTimestampRange(url, params);
		const measureType = getNumberParam(params, "measureType");
		const category = getNumberParam(params, "category");
		if (measureType !== undefined) {
			url.searchParams.set("meastype", String(Math.floor(measureType)));
		}
		if (category !== undefined) {
			url.searchParams.set("category", String(Math.floor(category)));
		}

		return fetchWithingsJson({ url: url.toString(), token });
	}

	if (operation === "activity") {
		const url = new URL(`${WITHINGS_API_BASE_URL}/v2/measure`);
		url.searchParams.set("action", "getactivity");
		addDateRange(url, params);

		return fetchWithingsJson({ url: url.toString(), token });
	}

	if (operation === "sleep_summary") {
		const url = new URL(`${WITHINGS_API_BASE_URL}/v2/sleep`);
		url.searchParams.set("action", "getsummary");
		addDateRange(url, params);

		return fetchWithingsJson({ url: url.toString(), token });
	}

	throw new AssistantError("Unsupported Withings operation", ErrorType.PARAMS_ERROR, 400);
}
