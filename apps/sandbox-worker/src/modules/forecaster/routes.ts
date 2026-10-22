import { errorResponse } from "@ngriffin_uk/polychat-library-sandbox";
import { forecasterRequestSchema, forecasterResultSchema } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import type { Env } from "../../types";
import { FORECASTER_POOL_SIZE, INTERNAL_FORECASTER_ORIGIN } from "./config";

function readError(body: string): string {
  const parsed = safeParseJson<{ error?: unknown }>(body);

  return typeof parsed?.error === "string" ? parsed.error : "Forecast failed";
}

export async function handleForecasterTraffic(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.origin !== INTERNAL_FORECASTER_ORIGIN) {
    return null;
  }

  if (url.pathname !== "/forecast") {
    return errorResponse(404, "Not found");
  }

  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  const parsed = forecasterRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return errorResponse(400, "Invalid forecast request");
  }

  const slot = Math.floor(Math.random() * FORECASTER_POOL_SIZE);
  const forecaster = env.FORECASTER.get(env.FORECASTER.idFromName(`forecaster-${slot}`));

  try {
    const reply = await forecaster.forecast(JSON.stringify(parsed.data));

    if (reply.status !== 200) {
      return errorResponse(reply.status >= 500 ? 502 : reply.status, readError(reply.body));
    }

    const result = forecasterResultSchema.safeParse(safeParseJson<unknown>(reply.body));

    return result.success
      ? Response.json(result.data)
      : errorResponse(502, "The forecaster returned an unreadable result");
  } catch {
    return errorResponse(503, "The forecaster is unavailable");
  }
}
