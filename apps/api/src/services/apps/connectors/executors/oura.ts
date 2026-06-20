import { AssistantError, ErrorType } from "~/utils/errors";
import { fetchConnectorJson } from "./http";
import { getStringParam } from "./params";

export async function executeOuraOperation(
	token: string,
	operation: string,
	params: Record<string, unknown>,
) {
	const endpointByOperation: Record<string, string> = {
		daily_readiness: "daily_readiness",
		daily_sleep: "daily_sleep",
		daily_activity: "daily_activity",
	};
	const endpoint = endpointByOperation[operation];
	if (!endpoint) {
		throw new AssistantError("Unsupported Oura operation", ErrorType.PARAMS_ERROR, 400);
	}

	const url = new URL(`https://api.ouraring.com/v2/usercollection/${endpoint}`);
	const startDate = getStringParam(params, "startDate");
	const endDate = getStringParam(params, "endDate");
	if (startDate) {
		url.searchParams.set("start_date", startDate);
	}
	if (endDate) {
		url.searchParams.set("end_date", endDate);
	}
	return fetchConnectorJson({ url: url.toString(), token });
}
