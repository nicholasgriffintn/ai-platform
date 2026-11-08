import type {
  ToolUseEvalArgsPattern,
  ToolUseEvalCallPattern,
  ToolUseEvalExpectation,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord, readPathValues } from "@ngriffin_uk/polychat-utility-core";

export interface ToolUseCallRecord {
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolUseTrajectoryView {
  calls: readonly ToolUseCallRecord[];
  texts: readonly string[];
  finalText: string;
}

export type ToolUseCheck = keyof ToolUseEvalExpectation;

export interface ToolUseCheckFailure {
  check: ToolUseCheck;
  detail: string;
}

export interface ToolUseGrade {
  passed: boolean;
  failures: ToolUseCheckFailure[];
}

export interface ToolUseCaseVerdict {
  passed: boolean;
  needsTieBreak: boolean;
}

const NUMERIC_BOUND = /^(<=|>=)\s*(-?\d+(?:\.\d+)?)$/;
const INDEX_SEGMENT = /^\d+$/;

function toPath(key: string): (string | number)[] {
  return key.split(".").map((segment) => (INDEX_SEGMENT.test(segment) ? Number(segment) : segment));
}

function asSearchText(value: unknown): string {
  return (typeof value === "string" ? value : (JSON.stringify(value) ?? "")).toLowerCase();
}

function asComparableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return Array.isArray(value) ? value.length : null;
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null;
}

export function matchesArgValue(expected: unknown, actual: unknown): boolean {
  if (expected === null) {
    return isAbsent(actual);
  }

  if (typeof expected === "string") {
    if (expected.startsWith("~")) {
      return !isAbsent(actual) && asSearchText(actual).includes(expected.slice(1).toLowerCase());
    }

    const bound = NUMERIC_BOUND.exec(expected);

    if (bound) {
      const value = asComparableNumber(actual);
      const limit = Number(bound[2]);

      return value !== null && (bound[1] === "<=" ? value <= limit : value >= limit);
    }

    return actual === expected;
  }

  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.every((item) => actual.some((entry) => matchesArgValue(item, entry)))
    );
  }

  if (isRecord(expected)) {
    return isRecord(actual) && matchesToolArgs(expected, actual);
  }

  return Object.is(expected, actual);
}

export function matchesToolArgs(
  pattern: ToolUseEvalArgsPattern,
  args: Record<string, unknown>,
): boolean {
  return Object.entries(pattern).every(([key, expected]) => {
    const values = readPathValues(args, toPath(key));

    if (expected === null) {
      return values.every(isAbsent);
    }

    return values.some((value) => matchesArgValue(expected, value));
  });
}

export function matchesCallPattern(
  pattern: ToolUseEvalCallPattern,
  call: ToolUseCallRecord,
): boolean {
  return call.tool === pattern.tool && (!pattern.args || matchesToolArgs(pattern.args, call.args));
}

function describePattern(pattern: ToolUseEvalCallPattern): string {
  return pattern.args ? `${pattern.tool} ${JSON.stringify(pattern.args)}` : pattern.tool;
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function collectMonotoneFailures(
  expect: ToolUseEvalExpectation,
  trajectory: ToolUseTrajectoryView,
): ToolUseCheckFailure[] {
  const failures: ToolUseCheckFailure[] = [];
  const allText = trajectory.texts.join("\n");

  for (const pattern of expect.callsMustNot ?? []) {
    if (trajectory.calls.some((call) => matchesCallPattern(pattern, call))) {
      failures.push({ check: "callsMustNot", detail: `called ${describePattern(pattern)}` });
    }
  }

  if (expect.maxCalls !== undefined && trajectory.calls.length > expect.maxCalls) {
    failures.push({
      check: "maxCalls",
      detail: `${trajectory.calls.length} calls, at most ${expect.maxCalls} allowed`,
    });
  }

  for (const text of expect.textMustNot ?? []) {
    if (includesText(allText, text)) {
      failures.push({ check: "textMustNot", detail: `said "${text}"` });
    }
  }

  return failures;
}

function findOrderBreak(
  order: readonly ToolUseEvalCallPattern[],
  calls: readonly ToolUseCallRecord[],
): ToolUseEvalCallPattern | null {
  let previous = -1;

  for (const pattern of order) {
    const first = calls.findIndex((call) => matchesCallPattern(pattern, call));

    if (first <= previous) {
      return pattern;
    }

    previous = first;
  }

  return null;
}

export function findMonotoneFailure(
  expect: ToolUseEvalExpectation,
  trajectory: ToolUseTrajectoryView,
): ToolUseCheckFailure | null {
  return collectMonotoneFailures(expect, trajectory)[0] ?? null;
}

export function gradeToolUse(
  expect: ToolUseEvalExpectation,
  trajectory: ToolUseTrajectoryView,
): ToolUseGrade {
  const failures = collectMonotoneFailures(expect, trajectory);
  const allText = trajectory.texts.join("\n");

  for (const pattern of expect.calls ?? []) {
    if (!trajectory.calls.some((call) => matchesCallPattern(pattern, call))) {
      failures.push({ check: "calls", detail: `never called ${describePattern(pattern)}` });
    }
  }

  const orderBreak = expect.order ? findOrderBreak(expect.order, trajectory.calls) : null;

  if (orderBreak) {
    failures.push({ check: "order", detail: `${describePattern(orderBreak)} was out of order` });
  }

  if (expect.minCalls !== undefined && trajectory.calls.length < expect.minCalls) {
    failures.push({
      check: "minCalls",
      detail: `${trajectory.calls.length} calls, at least ${expect.minCalls} needed`,
    });
  }

  for (const text of expect.textMust ?? []) {
    if (!includesText(allText, text)) {
      failures.push({ check: "textMust", detail: `never said "${text}"` });
    }
  }

  for (const text of expect.finalTextMust ?? []) {
    if (!includesText(trajectory.finalText, text)) {
      failures.push({ check: "finalTextMust", detail: `final reply lacks "${text}"` });
    }
  }

  return { passed: failures.length === 0, failures };
}

export function resolveToolUseCaseVerdict(samplePasses: readonly boolean[]): ToolUseCaseVerdict {
  const passes = samplePasses.filter(Boolean).length;
  const failures = samplePasses.length - passes;

  return { passed: passes > failures, needsTieBreak: passes === failures };
}

export function findToolUseRegressions(
  current: ReadonlyMap<string, boolean>,
  baseline: ReadonlyMap<string, boolean>,
): string[] {
  return [...current.entries()]
    .filter(([caseId, passed]) => !passed && baseline.get(caseId) === true)
    .map(([caseId]) => caseId);
}
