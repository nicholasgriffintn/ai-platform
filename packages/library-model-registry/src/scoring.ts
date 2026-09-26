import type { EvalCase, GraderConfig } from "@ngriffin_uk/polychat-schemas";
import { assertUnreachable } from "@ngriffin_uk/polychat-utility-core";

export type DeterministicGrader = Exclude<GraderConfig, { kind: "judge" }>;

function normaliseAnswer(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function lastNumber(value: string): number | null {
  const matches = value.match(/-?\d+(?:\.\d+)?/g);

  return matches ? Number(matches[matches.length - 1]) : null;
}

export function isDeterministicGrader(config: GraderConfig): config is DeterministicGrader {
  return config.kind !== "judge";
}

export function scoreDeterministic(
  config: DeterministicGrader,
  output: string,
  expected: string | undefined,
): number {
  switch (config.kind) {
    case "exact":
      return expected !== undefined && normaliseAnswer(output) === normaliseAnswer(expected)
        ? 1
        : 0;
    case "contains":
      return expected !== undefined && normaliseAnswer(output).includes(normaliseAnswer(expected))
        ? 1
        : 0;
    case "regex": {
      try {
        return new RegExp(config.pattern, "i").test(output) ? 1 : 0;
      } catch {
        return 0;
      }
    }

    case "json_schema": {
      try {
        const parsed: unknown = JSON.parse(output.trim());

        return typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          config.requiredKeys.every((key) => key in parsed)
          ? 1
          : 0;
      } catch {
        return 0;
      }
    }

    case "numeric": {
      const actual = lastNumber(output);
      const target = expected === undefined ? null : lastNumber(expected);

      return actual !== null && target !== null && Math.abs(actual - target) <= config.tolerance
        ? 1
        : 0;
    }

    default:
      return assertUnreachable(config);
  }
}

export function buildJudgePrompt({
  rubric,
  input,
  output,
  expected,
}: {
  rubric: string;
  input: string;
  output: string;
  expected?: string;
}): string {
  return [
    "You are grading one response from a language model. Apply the rubric strictly.",
    `Rubric:\n${rubric}`,
    `Input:\n${input}`,
    expected ? `Reference answer:\n${expected}` : null,
    `Response to grade:\n${output}`,
    'Reply with JSON only: {"score": <integer 1-5>, "reason": "<one sentence>"}',
  ]
    .filter((part) => part !== null)
    .join("\n\n");
}

export function parseJudgeScore(text: string): number | null {
  const match = text.match(/"score"\s*:\s*([1-5])/) ?? text.match(/\b([1-5])\s*\/\s*5\b/);

  if (!match) {
    return null;
  }

  return (Number(match[1]) - 1) / 4;
}

export interface ParsedEvalCases {
  cases: EvalCase[];
  errors: string[];
}

export function parseEvalCaseLines(text: string): ParsedEvalCases {
  const cases: EvalCase[] = [];
  const errors: string[] = [];

  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((line, index) => {
      const id = `case-${index + 1}`;

      if (line.startsWith("{")) {
        try {
          const parsed: unknown = JSON.parse(line);

          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "input" in parsed &&
            typeof parsed.input === "string"
          ) {
            cases.push({
              id,
              input: parsed.input,
              expected:
                "expected" in parsed && typeof parsed.expected === "string"
                  ? parsed.expected
                  : undefined,
            });
          } else {
            errors.push(`Line ${index + 1} needs an "input" string`);
          }
        } catch {
          errors.push(`Line ${index + 1} is not valid JSON`);
        }

        return;
      }

      const [input, expected] = line.split(" => ");

      cases.push({ id, input: input.trim(), expected: expected?.trim() || undefined });
    });

  return { cases, errors };
}
