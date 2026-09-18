import { isDeepStrictEqual } from "node:util";

export function hasOwn(objectValue, key) {
  return Object.prototype.hasOwnProperty.call(objectValue, key);
}

export function differingValues(record, defaults) {
  return Object.fromEntries(
    Object.entries(record).filter(([key, value]) => !isDeepStrictEqual(value, defaults[key])),
  );
}

export function majorityValues(records, fields) {
  const result = {};
  const keys = new Set(records.flatMap((record) => Object.keys(record)));

  for (const key of keys) {
    if (fields && !fields.has(key)) {
      continue;
    }

    const values = records.filter((record) => hasOwn(record, key)).map((record) => record[key]);
    let bestCount = records.length / 2;

    for (const value of values) {
      const count = values.filter((candidate) => isDeepStrictEqual(candidate, value)).length;

      if (count > bestCount) {
        result[key] = value;
        bestCount = count;
      }
    }
  }

  return result;
}

export function readNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function scoreHigherIsBetter(value, thresholds) {
  if (value === undefined) {
    return undefined;
  }

  for (let index = 0; index < thresholds.length; index += 1) {
    if (value >= thresholds[index]) {
      return thresholds.length - index + 1;
    }
  }

  return value > 0 ? 1 : undefined;
}

export function scoreLowerIsBetter(value, thresholds) {
  if (value === undefined) {
    return undefined;
  }

  for (let index = 0; index < thresholds.length; index += 1) {
    if (value <= thresholds[index]) {
      return thresholds.length - index + 1;
    }
  }

  return value > 0 ? 1 : undefined;
}

export function averageDefined(values) {
  const defined = values.filter((value) => value !== undefined);

  if (defined.length === 0) {
    return undefined;
  }

  return defined.reduce((total, value) => total + value, 0) / defined.length;
}

export function clampRouterScore(value) {
  if (value === undefined) {
    return undefined;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

export function formatMonth(year, month) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return months[month - 1] ?? `${year}-${String(month).padStart(2, "0")}`;
}

export function formatHumanDate(value) {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  const fullDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (fullDate) {
    const year = Number(fullDate[1]);
    const month = Number(fullDate[2]);
    const day = Number(fullDate[3]);

    return `${formatMonth(year, month)} ${day}, ${year}`;
  }

  const yearMonth = /^(\d{4})-(\d{2})$/.exec(value);

  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);

    return `${formatMonth(year, month)} ${year}`;
  }

  return value;
}

export function toPer1k(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  const converted = value / 1000;
  const normalized = Number.parseFloat(converted.toFixed(10));

  return Number.isFinite(normalized) ? normalized : undefined;
}
