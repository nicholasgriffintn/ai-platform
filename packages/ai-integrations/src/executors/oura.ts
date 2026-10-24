import { shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createConnectorJsonClient } from "./http";
import { getStringParam } from "./params";

const OURA_API_BASE_URL = "https://api.ouraring.com/v2";
const fetchOuraJson = createConnectorJsonClient(OURA_API_BASE_URL);
const OURA_COLLECTIONS: Record<string, string> = {
  get_daily_readiness: "daily_readiness",
  get_daily_sleep: "daily_sleep",
  get_daily_activity: "daily_activity",
};
const DEFAULT_DAYS = 7;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readCalendarDate(params: Record<string, unknown>, key: string): string | undefined {
  const value = getStringParam(params, key);

  if (value && !CALENDAR_DATE.test(value)) {
    throw new AssistantError(`${key} must be a YYYY-MM-DD date`, ErrorType.PARAMS_ERROR, 400);
  }

  return value;
}

export async function executeOuraOperation(
  token: string,
  operation: string,
  params: Record<string, unknown>,
) {
  const collection = OURA_COLLECTIONS[operation];

  if (!collection) {
    throw new AssistantError("Unsupported Oura operation", ErrorType.PARAMS_ERROR, 400);
  }

  const endDate = readCalendarDate(params, "endDate") ?? new Date().toISOString().slice(0, 10);
  const startDate =
    readCalendarDate(params, "startDate") ?? shiftCalendarDate(endDate, -DEFAULT_DAYS);
  const query = new URLSearchParams({ start_date: startDate, end_date: endDate });

  return fetchOuraJson({ path: `/v2/usercollection/${collection}?${query.toString()}`, token });
}
