import type { TimeSeriesForecastRequest } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { forecastTimeSeries } from "./forecast";

const request: TimeSeriesForecastRequest = {
  series: [{ name: "visits", values: [10, 12, null, 15] }],
  horizon: 2,
  timestamps: ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"],
  quantiles: [0.9, 0.1],
};

function workerReplying(status: number, body: unknown) {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    Response.json(body, { status }),
  );

  return { fetch, env: { SANDBOX_WORKER: { fetch } } };
}

describe("forecastTimeSeries", () => {
  it("always asks for the median and names each quantile row", async () => {
    const { env, fetch } = workerReplying(200, {
      model: "timestral-209m",
      quantiles: [0.1, 0.5, 0.9],
      values: [
        [
          [14, 15],
          [16, 17],
          [18, 19],
        ],
      ],
      elapsedMs: 12,
    });

    const forecast = await forecastTimeSeries(env, request);

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      targets: [[10, 12, null, 15]],
      quantiles: [0.1, 0.5, 0.9],
    });
    expect(forecast).toEqual({
      model: "timestral-209m",
      horizon: 2,
      timestamps: ["2026-03-05", "2026-03-06"],
      elapsedMs: 12,
      series: [
        {
          name: "visits",
          quantiles: [
            { level: 0.1, values: [14, 15] },
            { level: 0.5, values: [16, 17] },
            { level: 0.9, values: [18, 19] },
          ],
        },
      ],
    });
  });

  it("passes the forecaster's own complaint back as a bad request", async () => {
    const { env } = workerReplying(400, { error: "known covariates are too short" });

    await expect(forecastTimeSeries(env, request)).rejects.toMatchObject({
      message: "known covariates are too short",
      statusCode: 400,
    });
  });

  it("refuses a result that does not cover the horizon", async () => {
    const { env } = workerReplying(200, {
      model: "timestral-209m",
      quantiles: [0.1, 0.5, 0.9],
      values: [[[14], [16], [18]]],
      elapsedMs: 12,
    });

    await expect(forecastTimeSeries(env, request)).rejects.toMatchObject({ statusCode: 502 });
  });
});
