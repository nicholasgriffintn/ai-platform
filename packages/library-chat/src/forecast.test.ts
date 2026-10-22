import { timeSeriesForecastRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildForecastRequest, readForecastTable } from "./forecast";

const CSV = [
  "date,visits,promo,region",
  "2026-03-01,120,0,north",
  '2026-03-02,"1,340",1,north',
  "2026-03-03,,0,south",
  "2026-03-04,150,0,south",
  "2026-03-05,,1,north",
  "2026-03-06,,0,north",
].join("\n");

describe("readForecastTable", () => {
  it("tells time, numeric and text columns apart and keeps gaps as missing", () => {
    const table = readForecastTable(CSV);

    expect(table.rowCount).toBe(6);
    expect(table.columns.map(({ name, kind }) => [name, kind])).toEqual([
      ["date", "time"],
      ["visits", "numeric"],
      ["promo", "numeric"],
      ["region", "text"],
    ]);
    expect(table.columns[1]?.values).toEqual([120, 1340, null, 150, null, null]);
  });
});

describe("buildForecastRequest", () => {
  const table = readForecastTable(CSV);

  it("ends the history at the last observed value and reads known columns into the horizon", () => {
    const result = buildForecastRequest(table, {
      targets: ["visits"],
      knownCovariates: ["promo"],
      timeColumn: "date",
      horizon: 2,
    });

    expect(result).toEqual({
      ok: true,
      request: {
        series: [{ name: "visits", values: [120, 1340, null, 150] }],
        horizon: 2,
        timestamps: ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"],
        knownCovariates: [{ name: "promo", values: [0, 1, 0, 0, 1, 0] }],
      },
    });
    expect(result.ok && timeSeriesForecastRequestSchema.safeParse(result.request).success).toBe(
      true,
    );
  });

  it("refuses known columns that stop short of the horizon", () => {
    expect(
      buildForecastRequest(table, { targets: ["visits"], knownCovariates: ["promo"], horizon: 3 }),
    ).toEqual({
      ok: false,
      error: "Known-ahead columns need 3 rows past the last value, and the table has 2",
    });
  });
});
