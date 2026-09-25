import type { EvidenceStatus } from "@ngriffin_uk/polychat-schemas";

export type PiiKind = "email" | "phone" | "card_number" | "uk_national_insurance" | "ip_address";

const PII_PATTERNS: Array<[PiiKind, RegExp]> = [
  ["email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ["phone", /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}\b/g],
  ["uk_national_insurance", /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi],
  ["ip_address", /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g],
];

const CARD_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g;

export interface PiiSampleAssessment {
  status: EvidenceStatus;
  rowsSampled: number;
  rowsWithPii: number;
  counts: Record<PiiKind, number>;
}

export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;

    if (double) {
      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    double = !double;
  }

  return digits.length >= 13 && sum % 10 === 0;
}

export function countPii(text: string): Record<PiiKind, number> {
  const counts: Record<PiiKind, number> = {
    email: 0,
    phone: 0,
    card_number: 0,
    uk_national_insurance: 0,
    ip_address: 0,
  };

  for (const [kind, pattern] of PII_PATTERNS) {
    counts[kind] = text.match(pattern)?.length ?? 0;
  }

  counts.card_number = (text.match(CARD_CANDIDATE) ?? []).filter((candidate) =>
    passesLuhn(candidate.replace(/[ -]/g, "")),
  ).length;

  return counts;
}

export function assessPiiSample(
  rows: readonly string[],
  { failRatio = 0.01 }: { failRatio?: number } = {},
): PiiSampleAssessment {
  const counts: Record<PiiKind, number> = {
    email: 0,
    phone: 0,
    card_number: 0,
    uk_national_insurance: 0,
    ip_address: 0,
  };
  let rowsWithPii = 0;

  for (const row of rows) {
    const rowCounts = countPii(row);
    let found = false;

    for (const kind of Object.keys(rowCounts) as PiiKind[]) {
      counts[kind] += rowCounts[kind];
      found ||= rowCounts[kind] > 0;
    }

    if (found) {
      rowsWithPii += 1;
    }
  }

  const ratio = rows.length === 0 ? 0 : rowsWithPii / rows.length;
  const status: EvidenceStatus =
    rows.length === 0 ? "unknown" : ratio > failRatio ? "fail" : rowsWithPii > 0 ? "warn" : "pass";

  return { status, rowsSampled: rows.length, rowsWithPii, counts };
}
