import type { ForecastSelection } from "@ngriffin_uk/polychat-library-chat/forecast";

export interface ForecastSample {
  id: string;
  name: string;
  hint: string;
  csv: string;
  selection: ForecastSelection;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const START = Date.UTC(2026, 3, 1);

function wobble(index: number): number {
  return Math.sin(index * 1.7) * 0.6 + Math.sin(index * 0.37 + 1) * 0.4;
}

function isoDay(index: number): string {
  return new Date(START + index * DAY_MS).toISOString().slice(0, 10);
}

function isoHour(index: number): string {
  return new Date(START + index * HOUR_MS).toISOString().slice(0, 16);
}

function toCsv(header: readonly string[], rows: readonly (string | number)[][]): string {
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function visitorsSample(): string {
  const rows = Array.from({ length: 140 }, (_, day) => {
    const weekly = [0.82, 1, 1.04, 1.02, 0.97, 0.7, 0.62][day % 7] ?? 1;
    const visitors = (900 + day * 4.5) * weekly + wobble(day) * 60;

    return [isoDay(day), Math.round(visitors)];
  });

  return toCsv(["date", "visitors"], rows);
}

function seedShopSample(): string {
  const history = 112;
  const rows = Array.from({ length: history + 21 }, (_, day) => {
    const promo = day % 28 >= 21 && day % 28 < 24 ? 1 : 0;
    const weekend = day % 7 >= 5 ? 1.25 : 1;
    const sales = (310 + day * 0.8) * weekend * (promo ? 1.6 : 1) + wobble(day) * 22;

    return [isoDay(day), day < history ? Math.round(sales) : "", promo];
  });

  return toCsv(["date", "seed_sales", "promotion"], rows);
}

function energySample(): string {
  const rows = Array.from({ length: 24 * 21 }, (_, hour) => {
    const clock = hour % 24;
    const temperature = 11 + 5 * Math.sin(((clock - 9) / 24) * 2 * Math.PI) + wobble(hour) * 1.5;
    const daily = clock >= 7 && clock <= 22 ? 1.3 + 0.4 * Math.sin((clock / 24) * Math.PI) : 0.75;
    const load = 42 * daily + (18 - temperature) * 1.4 + wobble(hour * 3) * 2.5;

    return [isoHour(hour), load.toFixed(1), temperature.toFixed(1)];
  });

  return toCsv(["hour", "load_kw", "temperature_c"], rows);
}

export const FORECAST_SAMPLES: readonly ForecastSample[] = [
  {
    id: "visitors",
    name: "Daily visitors",
    hint: "A site that rests at weekends",
    csv: visitorsSample(),
    selection: { targets: ["visitors"], timeColumn: "date", horizon: 28 },
  },
  {
    id: "seed-shop",
    name: "Seed shop sales",
    hint: "Promotions planned three weeks out",
    csv: seedShopSample(),
    selection: {
      targets: ["seed_sales"],
      knownCovariates: ["promotion"],
      timeColumn: "date",
      horizon: 21,
    },
  },
  {
    id: "energy",
    name: "Hourly energy",
    hint: "Load, with the thermometer for company",
    csv: energySample(),
    selection: {
      targets: ["load_kw"],
      pastCovariates: ["temperature_c"],
      timeColumn: "hour",
      horizon: 48,
    },
  },
];
